import { z } from 'zod';
import { verify } from '@oss-commerce/storefront-sdk';
import { DomainEvent } from './model.ts';
import type { Engine } from './engine.ts';

/** Control-plane ingest for events from merchant cells. A cell signs each batch with its own secret. The batch may only contain events for the
 *  store that cell belongs to, so a compromised or misconfigured cell cannot fire automations for another merchant. Safe to redeliver:
 *  the engine de-duplicates on event id, so a retry after a timeout never sends a second email. */
export interface IngestDeps { engine: Pick<Engine, 'handleEvent'>; cellSecret(cellId: string): Promise<{ secret: string; storeId: string } | null> }
const Batch = z.object({ cellId: z.string(), events: z.array(z.unknown()).min(1).max(50) });

export async function handleIngest(d: IngestDeps, rawBody: string, sig: string | null | undefined): Promise<{ status: number; body: Record<string, unknown> }> {
  let cellId: string; try { cellId = String(JSON.parse(rawBody)?.cellId ?? ''); } catch { return { status: 400, body: { error: 'invalid body' } }; }
  const cell = cellId ? await d.cellSecret(cellId) : null;
  if (!cell || !verify(cell.secret, rawBody, sig).ok) return { status: 401, body: { error: 'unauthorized' } };       // same answer for unknown cell and bad signature
  const b = Batch.safeParse(JSON.parse(rawBody)); if (!b.success) return { status: 400, body: { error: 'invalid batch' } };
  const accepted: string[] = [], rejected: { id?: string; reason: string }[] = [];
  for (const raw of b.data.events) {
    const e = DomainEvent.safeParse(raw);
    if (!e.success) { rejected.push({ id: (raw as any)?.id, reason: 'invalid' }); continue; }
    if (e.data.storeId !== cell.storeId) { rejected.push({ id: e.data.id, reason: 'wrong_store' }); continue; }
    await d.engine.handleEvent(e.data); accepted.push(e.data.id);
  }
  return { status: rejected.length ? 207 : 200, body: { accepted, rejected } };
}
