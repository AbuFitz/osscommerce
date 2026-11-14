import type { StoreView, Summary } from './gateway';

/**
 * Decides what the Overview shows. Pure and deterministic so it can be tested.
 * Principle: lead with the single most useful next action, show a widget only when it
 * answers a question for this store right now, and never hide a critical alert.
 */
export type HeroKind = 'first_product' | 'connect_payments' | 'fulfil' | 'finish_setup' | 'caught_up';
export interface Facts { store: StoreView; summary: Summary; products: number; orders: number; failed: number }
export interface KpiKey { key: 'orders' | 'aov' | 'refunded' | 'lowStock' | 'products' | 'toFulfil' }
export interface Plan { hero: HeroKind; showSetup: boolean; showCharts: boolean; showCustomers: boolean; attention: string[]; kpis: KpiKey['key'][] }

export function plan({ store, summary: s, products, orders, failed }: Facts): Plan {
  const gate = (g: string) => store.readiness.find(r => r.gate === g)?.done ?? false;
  const live = store.store.lifecycle === 'live';
  const open = store.readiness.filter(r => !r.done).length;

  const hero: HeroKind = products === 0 ? 'first_product'
    : !gate('payments_enabled') ? 'connect_payments'
    : s.toFulfil > 0 ? 'fulfil'
    : !live && open > 0 ? 'finish_setup'
    : 'caught_up';

  const attention: string[] = [];
  if (failed > 0) attention.push(`${failed} payment${failed > 1 ? 's' : ''} failed. No customer was charged.`);
  if (!live && store.store.paymentReadiness === 'restricted') attention.push('Stripe has restricted your account. Checkout is paused until it is resolved.');

  const kpis: Plan['kpis'] = [];
  if (orders > 0) kpis.push('orders', 'aov');
  else kpis.push('products');
  if (s.refundedMinor > 0) kpis.push('refunded');
  if (s.lowStock > 0) kpis.push('lowStock');
  if (kpis.length < 4 && s.toFulfil > 0 && !kpis.includes('toFulfil')) kpis.push('toFulfil');
  if (kpis.length < 4 && !kpis.includes('products')) kpis.push('products');

  return {
    hero,
    showSetup: !live,                       // the launch checklist disappears once live
    showCharts: orders >= 3,                // a chart of one or two points answers nothing
    showCustomers: orders > 0,
    attention,
    kpis: kpis.slice(0, 4),
  };
}
