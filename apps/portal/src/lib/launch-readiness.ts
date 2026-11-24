import type { Order, Readiness } from './gateway';

export function withTestOrder(readiness: Readiness[], orders: Pick<Order, 'payment'>[]): Readiness[] {
  const passed = orders.some(order => ['paid', 'partially_refunded', 'refunded'].includes(order.payment));
  return readiness.map(item => item.gate === 'test_order_passed' ? { ...item, done: passed } : item);
}

export const launchBlockers = (readiness: Readiness[]) => readiness.filter(item => !item.done && !['contract_signed', 'launch_approved'].includes(item.gate));
