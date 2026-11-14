import { readinessOf, type RetrievedAccount } from './v2.ts';
import type { PaymentReadiness } from './account-state.ts';

export interface PaymentAccountStore { get(storeId: string): Promise<{ readiness: PaymentReadiness; checkedAt: number } | null>; save(storeId: string, r: PaymentReadiness, checkedAt: number): Promise<void> }
export interface Retriever { retrieveAccount(account: string): Promise<RetrievedAccount> }

/** Stripe is the source of truth. Whatever event told us something changed, we re-read the account and store the result. The result is only
 *  stored if its read STARTED later than the stored one, so a slow older read can never overwrite a newer state (events can arrive in any order).
 *  An 'unknown' result (a read we could not interpret) never overwrites a known state. */
export async function refreshReadiness(d: { connect: Retriever; store: PaymentAccountStore; now?: () => number }, storeId: string, account: string): Promise<{ stored: boolean; readiness: PaymentReadiness }> {
  const startedAt = (d.now ?? Date.now)();
  const r = readinessOf(await d.connect.retrieveAccount(account));
  const prev = await d.store.get(storeId);
  if (r.status === 'unknown') return { stored: false, readiness: prev?.readiness ?? r };
  if (prev && prev.checkedAt > startedAt) return { stored: false, readiness: prev.readiness };
  await d.store.save(storeId, r, startedAt); return { stored: true, readiness: r };
}

/** Which account does an incoming Stripe event concern, and does it call for a refresh? Handles v1 events (existing accounts, OAuth) and v2 thin events. */
export function accountFromEvent(e: { type: string; account?: string; related_object?: { id: string; type?: string } }): string | null {
  if (e.type === 'account.updated' && e.account) return e.account;
  if (/^v2\.core\.account\[(configuration\.merchant|requirements|future_requirements|identity|defaults)\]\./.test(e.type) || e.type === 'v2.core.account.closed') return e.related_object?.id ?? null;
  return null;
}
