/**
 * Provision one store on a running engine, as the platform operator. Safe to repeat.
 *   ENGINE_ADMIN_URL=https://engine.example/admin-api SUPERADMIN_USER=... SUPERADMIN_PASSWORD=... \
 *   STORE_KEY=a STORE_NAME="Store A" STORE_CHANNEL_TOKEN=<random 16+> MERCHANT_EMAIL=... MERCHANT_PASSWORD=<12+> npx tsx src/provision-cli.ts
 */
import { provisionStore } from './cell/provision-store.ts';

const need = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`${k} is required`); return v; };
(async () => {
  const url = need('ENGINE_ADMIN_URL'); const password = need('MERCHANT_PASSWORD'); if (password.length < 12) throw new Error('MERCHANT_PASSWORD must be 12 characters or more');
  const token = need('STORE_CHANNEL_TOKEN'); if (token.length < 16) throw new Error('STORE_CHANNEL_TOKEN must be 16 characters or more');
  const login = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'mutation($u:String!,$p:String!){ login(username:$u,password:$p){ __typename ... on ErrorResult { message } } }', variables: { u: need('SUPERADMIN_USER'), p: need('SUPERADMIN_PASSWORD') } }) });
  const session = login.headers.get('vendure-auth-token'); if (!session) throw new Error('Operator sign-in failed.');
  const x = async (query: string, variables?: Record<string, unknown>) => { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` }, body: JSON.stringify({ query, variables }) }); const b = await r.json() as { data?: unknown; errors?: { message: string }[] }; if (b.errors?.length) throw new Error(b.errors[0].message); return b.data as any; };
  const r = await provisionStore(x, { key: need('STORE_KEY'), name: need('STORE_NAME'), channelToken: token, owner: { email: need('MERCHANT_EMAIL'), password, firstName: process.env.MERCHANT_FIRST_NAME, lastName: process.env.MERCHANT_LAST_NAME } });
  console.log(`store ${process.env.STORE_KEY} ready: channel ${r.channelId}, stock location ${r.stockLocationId}, administrator ${r.administratorId}`);
})().catch(e => { console.error('provisioning failed:', e instanceof Error ? e.message : e); process.exit(1); });
