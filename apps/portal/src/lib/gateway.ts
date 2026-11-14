import { LAUNCH_GATES, type LaunchGate, type StoreRecord } from '@oss-commerce/contracts';

/** Payment, fulfilment and order state are independent axes (research/02). */
export type PaymentStatus = 'pending' | 'authorised' | 'paid' | 'failed' | 'partially_refunded' | 'refunded' | 'disputed';
export type FulfilmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'returned';
export type OrderState = 'open' | 'cancelled' | 'completed';

export interface OrderLine { sku: string; title: string; variant?: string; qty: number; unitMinor: number }
export interface OrderEvent { at: string; text: string }
export interface Order {
  id: string; number: number; placedAt: string; customer: string; email: string;
  lines: OrderLine[]; shippingMinor: number; discountMinor: number; taxMinor: number; totalMinor: number;
  payment: PaymentStatus; fulfilment: FulfilmentStatus; state: OrderState;
  refundedMinor: number; timeline: OrderEvent[]; shipTo: string;
}
export interface Product { id: string; title: string; status: 'draft' | 'published' | 'archived'; sku: string; priceMinor: number; onHand: number; allocated: number; threshold: number; variants: number }
export interface Customer { id: string; name: string; email: string; orders: number; spentMinor: number; lastOrder: string; marketing: boolean }
export interface SalesPoint { day: string; netMinor: number }
export interface Summary { netMinor: number; orders: number; aovMinor: number; refundedMinor: number; toFulfil: number; lowStock: number; series: SalesPoint[]; asOf: string }
export interface Readiness { gate: LaunchGate; label: string; done: boolean; hint: string }
export interface StoreView { name: string; store: StoreRecord; readiness: Readiness[] }

/** The only seam to the commerce service. Server-side only; the browser never holds engine credentials. */
export interface CommerceGateway {
  store(): Promise<StoreView>;
  summary(): Promise<Summary>;
  orders(q?: { filter?: string; q?: string }): Promise<Order[]>;
  order(id: string): Promise<Order | null>;
  products(): Promise<Product[]>;
  customers(): Promise<Customer[]>;
}

export const GATE_COPY: Record<LaunchGate, { label: string; hint: string }> = {
  contract_signed: { label: 'Contract signed', hint: 'Handled in your OSS account.' },
  payments_enabled: { label: 'Payments connected', hint: 'Connect Stripe to accept payments.' },
  domain_verified: { label: 'Domain verified', hint: 'Add the DNS record we show you.' },
  test_order_passed: { label: 'Test order placed', hint: 'Place a test order in preview.' },
  launch_approved: { label: 'Launch approved', hint: 'You approve once the rest is done.' },
};
export { LAUNCH_GATES };
