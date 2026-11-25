import type { Order } from '../gateway';
import { locate } from './lookup';
export type MapPoint = { id: string; place: string; lat: number; lng: number; orders: number; salesMinor: number; sessions?: number; lastAt: string; precision: 'town' | 'country' };
export type RecentOrder = { id: string; number: number; place: string; totalMinor: number; at: string };
/** Where paid orders were delivered, grouped by place. Orders without a usable address are left off the map (never guessed). */
export function orderPoints(orders: Order[], sinceIso: string): MapPoint[] {
  const by = new Map<string, MapPoint>();
  for (const o of orders) {
    if (o.placedAt < sinceIso || o.payment === 'failed' || o.state === 'cancelled') continue;
    const at = locate(o.ship?.city, o.ship?.country); if (!at) continue;
    const id = `${at.lat},${at.lng}`; const p = by.get(id);
    if (p) { p.orders++; p.salesMinor += o.totalMinor; if (o.placedAt > p.lastAt) p.lastAt = o.placedAt; }
    else by.set(id, { id, place: at.place, lat: at.lat, lng: at.lng, orders: 1, salesMinor: o.totalMinor, lastAt: o.placedAt, precision: at.precision });
  }
  return [...by.values()].sort((a, b) => b.orders - a.orders || b.salesMinor - a.salesMinor);
}
export function recentOrders(orders: Order[], limit = 8): RecentOrder[] {
  return orders.filter(o => o.payment !== 'failed' && o.state !== 'cancelled').sort((a, b) => b.placedAt.localeCompare(a.placedAt)).slice(0, limit)
    .map(o => ({ id: o.id, number: o.number, place: locate(o.ship?.city, o.ship?.country)?.place ?? 'Address not recorded', totalMinor: o.totalMinor, at: o.placedAt }));
}
