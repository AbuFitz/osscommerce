import type { ServiceRequest } from './gateway';

export function serviceRequestView(row: Record<string, any>): ServiceRequest {
  return { id: row.id, kind: row.kind, title: row.title, detail: row.detail, status: row.status, quoteMinor: row.quote_minor ?? undefined, createdAt: new Date(row.created_at).toISOString() };
}

export function validateServiceRequest(title: string, detail: string): { title: string; detail: string; error?: string } {
  const cleanTitle = title.trim(); const cleanDetail = detail.trim();
  if (cleanTitle.length < 4 || cleanTitle.length > 160) return { title: cleanTitle, detail: cleanDetail, error: 'Use 4–160 characters for the request title.' };
  if (cleanDetail.length > 5000) return { title: cleanTitle, detail: cleanDetail, error: 'Keep the request details under 5,000 characters.' };
  return { title: cleanTitle, detail: cleanDetail };
}

export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
