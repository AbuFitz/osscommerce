import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { Enquiry, errorsOf } from '@/lib/enquiry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const G = globalThis as unknown as { __enq_pool?: Pool; __enq_hits?: Map<string, number[]> };
const pool = () => { const url = process.env.CONTROL_PLANE_DATABASE_URL; if (!url) return null; return (G.__enq_pool ??= new Pool({ connectionString: url, max: 2, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000 })); };
/** Soft per-instance limit: 5 submissions per address per 10 minutes. A real edge limit should sit in front in production. */
const limited = (ip: string) => { const m = (G.__enq_hits ??= new Map<string, number[]>()); const now = Date.now(); const hits = (m.get(ip) ?? []).filter(t => now - t < 600_000); hits.push(now); m.set(ip, hits); return hits.length > 5; };

/**
 * Stores an enquiry in the control-plane database. The connection should use a login role that is a member of oss_site (insert-only; see migration 0008). It answers 200 only after the row is written.
 * If storage is not configured or fails, it says so, and the page offers email instead. It never pretends.
 */
export async function POST(req: Request) {
  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ ok: false, code: 'bad_request' }, { status: 400 }); }
  const raw = body as Record<string, unknown>;
  // Honeypot: real people never fill this hidden field. Answer as if stored so bots learn nothing; nothing is saved.
  if (typeof raw?.company_url === 'string' && raw.company_url.length > 0) return NextResponse.json({ ok: true });
  const parsed = Enquiry.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, code: 'invalid', errors: errorsOf(parsed.error) }, { status: 422 });
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return NextResponse.json({ ok: false, code: 'rate_limited' }, { status: 429 });
  const db = pool(); if (!db) return NextResponse.json({ ok: false, code: 'not_configured' }, { status: 503 });
  const e = parsed.data;
  try {
    const id = randomUUID();
    await db.query('insert into cp.enquiries (id, name, email, phone, business, website, selling_now, product_range, message, source_path) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [id, e.name, e.email.toLowerCase(), e.phone ?? null, e.business, e.website ?? null, e.sellingNow, e.productRange, e.message ?? null, typeof raw.path === 'string' ? raw.path.slice(0, 200) : null]);
    return NextResponse.json({ ok: true, ref: id.slice(0, 8) });
  } catch (err) {
    console.error('enquiry_store_failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, code: 'store_failed' }, { status: 503 });
  }
}
