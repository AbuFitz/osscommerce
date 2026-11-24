import { Pool } from 'pg';
import { createResendClient, handleResendWebhook, PgStores } from '@oss-commerce/automation';
import { processResendWebhookRequest } from '@/lib/resend-webhook-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const G = globalThis as unknown as { __oss_email_pool?: Pool };

function dependencies() {
  const url = process.env.CONTROL_PLANE_DATABASE_URL;
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!url || !apiKey || !webhookSecret) return null;
  const pool = (G.__oss_email_pool ??= new Pool({ connectionString: url, max: 2, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000 }));
  const stores = new PgStores(pool);
  return { client: createResendClient(apiKey), webhookSecret, stores };
}

export async function POST(request: Request) {
  let deps: ReturnType<typeof dependencies>;
  try { deps = dependencies(); }
  catch { return Response.json({ error: 'not configured' }, { status: 503, headers: { 'cache-control': 'no-store' } }); }
  if (!deps) return Response.json({ error: 'not configured' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  try {
    return await processResendWebhookRequest(request, (payload, headers) => handleResendWebhook({
      client: deps.client,
      webhookSecret: deps.webhookSecret,
      resolveStore: messageId => deps.stores.resolveStoreForEmailMessage(messageId),
      apply: input => deps.stores.emailWebhook.apply(input),
    }, payload, headers));
  } catch (error) {
    console.error('resend_webhook_failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'temporarily unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
