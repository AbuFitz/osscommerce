import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { Engine, PgBossScheduler, PgStores, ResendSender, commerceEmailPreparer, createResendClient, createUnsubscribeToken, handleIngest, handleResendWebhook, parseUnsubscribeToken, startWorker, type Deps } from '@oss-commerce/automation';
import { loadConfig } from './config.ts';

const MAX_BODY = 1024 * 1024;
const json = (res: ServerResponse, status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const html = (res: ServerResponse, body: string) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' }); res.end(body); };
async function rawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { const b = Buffer.from(chunk); size += b.length; if (size > MAX_BODY) throw Object.assign(new Error('payload too large'), { status: 413 }); chunks.push(b); }
  return Buffer.concat(chunks).toString('utf8');
}

export async function start() {
  const cfg = loadConfig(process.env);
  const runtime = new Pool({ connectionString: cfg.CONTROL_PLANE_DATABASE_URL, max: 10, application_name: 'oss-automation-runtime' });
  const queueProbe = new Pool({ connectionString: cfg.QUEUE_DATABASE_URL, max: 1, application_name: 'oss-automation-ready' });
  const boss = new PgBoss({ connectionString: cfg.QUEUE_DATABASE_URL, schema: 'pgboss_automation' });
  await boss.start();
  const stores = new PgStores(runtime); const scheduler = new PgBossScheduler(boss);
  const sender = new ResendSender({ apiKey: cfg.RESEND_API_KEY, prepare: commerceEmailPreparer(storeId => stores.emailProfile.get(storeId), { fromName: 'OneSimpleCommerce', fromEmail: cfg.ACCOUNT_EMAIL_FROM, replyTo: cfg.ACCOUNT_EMAIL_REPLY_TO }) });
  const deps: Deps = {
    rules: stores.rules, events: stores.events, runs: stores.runs, suppression: stores.suppression, scheduler, sender,
    consent: stores.consent, state: stores.state, limits: stores.limits,
    clock: { now: () => new Date() }, newId: randomUUID,
    unsubscribeUrl: (storeId, email) => `${cfg.PUBLIC_BASE_URL}/unsubscribe?t=${createUnsubscribeToken(cfg.UNSUBSCRIBE_SECRET, storeId, email)}`,
  };
  const engine = new Engine(deps); await startWorker(boss, engine);
  const resendClient = createResendClient(cfg.RESEND_API_KEY); let stopping = false;
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? '/', cfg.PUBLIC_BASE_URL).pathname;
      if (req.method === 'GET' && path === '/healthz') return json(res, stopping ? 503 : 200, { ok: !stopping });
      if (req.method === 'GET' && path === '/readyz') { await Promise.all([runtime.query('select 1'), queueProbe.query('select 1')]); return json(res, 200, { ready: true }); }
      if ((req.method === 'GET' || req.method === 'POST') && path === '/unsubscribe') {
        const token = new URL(req.url ?? '/', cfg.PUBLIC_BASE_URL).searchParams.get('t') ?? ''; const target = parseUnsubscribeToken(cfg.UNSUBSCRIBE_SECRET, token);
        if (!target) return json(res, 400, { error: 'invalid link' });
        if (req.method === 'GET') return html(res, `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Unsubscribe</title><body style="font:16px system-ui;max-width:36rem;margin:10vh auto;padding:1.5rem"><h1>Stop marketing emails?</h1><p>Order and account emails will still arrive.</p><form method="post" action="/unsubscribe?t=${token}"><button style="font:inherit;padding:.75rem 1rem">Unsubscribe</button></form></body></html>`);
        await stores.unsubscribe(target.storeId, target.email);
        return json(res, 200, { unsubscribed: true });
      }
      if (req.method !== 'POST') return json(res, 404, { error: 'not found' });
      const body = await rawBody(req);
      if (path === '/events/ingest') {
        const signature = req.headers['oss-signature'];
        const result = await handleIngest({ engine, cellSecret: async cellId => cfg.cells[cellId] ?? null }, body, Array.isArray(signature) ? signature[0] : signature);
        return json(res, result.status, result.body);
      }
      if (path === '/webhooks/resend') {
        const result = await handleResendWebhook({ client: resendClient, webhookSecret: cfg.RESEND_WEBHOOK_SECRET, resolveStore: id => stores.resolveStoreForEmailMessage(id), apply: input => stores.emailWebhook.apply(input) }, body,
          { id: Array.isArray(req.headers['svix-id']) ? req.headers['svix-id'][0] : req.headers['svix-id'], timestamp: Array.isArray(req.headers['svix-timestamp']) ? req.headers['svix-timestamp'][0] : req.headers['svix-timestamp'], signature: Array.isArray(req.headers['svix-signature']) ? req.headers['svix-signature'][0] : req.headers['svix-signature'] });
        return json(res, result.status, result.body);
      }
      return json(res, 404, { error: 'not found' });
    } catch (error) { const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 503; console.error('automation_request_failed', error instanceof Error ? error.name : 'unknown'); return json(res, status, { error: status === 413 ? 'payload too large' : 'temporarily unavailable' }); }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(cfg.PORT, resolve); });
  const stop = async () => { if (stopping) return; stopping = true; await new Promise<void>(resolve => server.close(() => resolve())); await boss.stop({ graceful: true, timeout: 30_000 }).catch(() => {}); await Promise.all([runtime.end(), queueProbe.end()]); };
  process.once('SIGTERM', () => { void stop(); }); process.once('SIGINT', () => { void stop(); });
  console.log(`automation_worker_listening port=${cfg.PORT}`);
  return { server, stop };
}

if (process.env.NODE_ENV !== 'test') void start().catch(error => { console.error('automation_worker_start_failed', error instanceof Error ? error.name : 'unknown'); process.exitCode = 1; });
