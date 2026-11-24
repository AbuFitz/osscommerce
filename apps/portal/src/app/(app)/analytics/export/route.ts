import { NextResponse } from 'next/server';
import { gateway } from '@/lib/gateway-instance';
import { buildReport, resolveRange, toCsv, ymd } from '@/lib/analytics';

export const dynamic = 'force-dynamic';
/** CSV of the daily figures for the chosen range. Uses the signed-in merchant's own session like every other page. */
export async function GET(req: Request) {
  const u = new URL(req.url); const today = ymd((await gateway().summary()).asOf);
  const range = resolveRange({ range: u.searchParams.get('range') ?? undefined, from: u.searchParams.get('from') ?? undefined, to: u.searchParams.get('to') ?? undefined }, today);
  const days = Math.round((Date.parse(`${range.to}T12:00:00Z`) - Date.parse(`${range.from}T12:00:00Z`)) / 86400_000) + 1;
  const r = buildReport(await gateway().reportOrders(ymd(new Date(Date.parse(`${range.from}T12:00:00Z`) - days * 86400_000))), range);
  return new NextResponse(toCsv(r), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="sales-${range.from}-to-${range.to}.csv"`, 'cache-control': 'no-store' } });
}
