import { feeMinor } from '@oss-commerce/contracts';

/** A merchant-visible financial ledger built from Stripe balance transactions on the connected account. Entries are immutable and keyed by the
 *  provider's transaction id, so re-importing the same page of history can never double count. Amounts are integer minor units; money out is negative. */
export interface BalanceTxn { id: string; type: string; reporting_category?: string; amount: number; fee: number; fee_details?: { type: string; amount: number }[]; net: number; currency: string; created: number; source?: string; description?: string | null; metadata?: Record<string, string> }
export type Kind = 'sale' | 'refund' | 'dispute' | 'dispute_reversal' | 'payout' | 'adjustment';
export interface LedgerEntry { sourceId: string; kind: Kind; orderCode?: string; gross: number; processingFee: number; applicationFee: number; net: number; currency: string; occurredAt: string; chargeId?: string }

const KIND: Record<string, Kind> = { charge: 'sale', refund: 'refund', dispute: 'dispute', dispute_reversal: 'dispute_reversal', payout: 'payout' };
export function toEntry(t: BalanceTxn): LedgerEntry {
  const cat = t.reporting_category ?? t.type; const kind = KIND[cat] ?? KIND[t.type] ?? 'adjustment';
  const app = (t.fee_details ?? []).filter(f => f.type === 'application_fee').reduce((s, f) => s + f.amount, 0);
  const proc = t.fee - app;
  return { sourceId: t.id, kind, orderCode: t.metadata?.orderCode, gross: t.amount, processingFee: proc, applicationFee: app, net: t.net, currency: t.currency.toLowerCase(), occurredAt: new Date(t.created * 1000).toISOString(), chargeId: t.source };
}
export class Ledger {
  private m = new Map<string, LedgerEntry>();
  import(txns: BalanceTxn[]): { added: number; skipped: number } { let added = 0; for (const t of txns) { if (this.m.has(t.id)) continue; this.m.set(t.id, toEntry(t)); added++; } return { added, skipped: txns.length - added }; }
  all() { return [...this.m.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)); }
  /** Per-currency summary for a period. Net = gross sales less refunds, disputes and all fees; payouts are shown separately as they only move money. */
  summary(from: string, to: string) {
    const s = { sales: 0, refunds: 0, disputes: 0, processingFees: 0, applicationFees: 0, net: 0, paidOut: 0 };
    for (const e of this.all().filter(e => e.occurredAt >= from && e.occurredAt < to)) {
      if (e.kind === 'payout') { s.paidOut += -e.net; continue; }
      if (e.kind === 'sale') s.sales += e.gross; if (e.kind === 'refund') s.refunds += -e.gross; if (e.kind === 'dispute') s.disputes += -e.gross; if (e.kind === 'dispute_reversal') s.disputes -= e.gross;
      s.processingFees += e.processingFee; s.applicationFees += e.applicationFee; s.net += e.net;
    }
    return s;
  }
}

export interface OrderPayment { orderCode: string; paidMinor: number; refundedMinor: number; currency: string }
export type Discrepancy = { type: 'missing_in_ledger' | 'missing_in_orders' | 'amount_mismatch' | 'refund_mismatch' | 'fee_mismatch'; orderCode: string; expected?: number; actual?: number };
/** Compares what the shop believes it was paid with what Stripe actually settled. Run daily and after webhook gaps. A clean run means every order ties out. */
export function reconcile(orders: OrderPayment[], entries: LedgerEntry[], feeBp: number): Discrepancy[] {
  const out: Discrepancy[] = []; const by = new Map<string, { sale: number; app: number; refund: number }>();
  for (const e of entries) { if (!e.orderCode) continue; const x = by.get(e.orderCode) ?? { sale: 0, app: 0, refund: 0 }; if (e.kind === 'sale') { x.sale += e.gross; x.app += e.applicationFee; } if (e.kind === 'refund') x.refund += -e.gross; by.set(e.orderCode, x); }
  for (const o of orders) {
    const x = by.get(o.orderCode);
    if (!x) { if (o.paidMinor > 0) out.push({ type: 'missing_in_ledger', orderCode: o.orderCode, expected: o.paidMinor }); continue; }
    if (x.sale !== o.paidMinor) out.push({ type: 'amount_mismatch', orderCode: o.orderCode, expected: o.paidMinor, actual: x.sale });
    if (x.refund !== o.refundedMinor) out.push({ type: 'refund_mismatch', orderCode: o.orderCode, expected: o.refundedMinor, actual: x.refund });
    const expectedFee = feeMinor(o.paidMinor, feeBp); if (x.app !== expectedFee) out.push({ type: 'fee_mismatch', orderCode: o.orderCode, expected: expectedFee, actual: x.app });
  }
  const known = new Set(orders.map(o => o.orderCode)); for (const [code, x] of by) if (!known.has(code) && x.sale > 0) out.push({ type: 'missing_in_orders', orderCode: code, actual: x.sale });
  return out;
}
