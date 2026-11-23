import type { ResendWebhookHeaders } from '@oss-commerce/automation';

export const MAX_RESEND_WEBHOOK_BYTES = 256 * 1024;
export type ResendWebhookResult = { status: number; body: Record<string, unknown> };

/** Reads the body exactly once as text so signature verification receives the provider's untouched payload. */
export async function processResendWebhookRequest(
  request: Request,
  dispatch: (payload: string, headers: ResendWebhookHeaders) => Promise<ResendWebhookResult>,
): Promise<Response> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_RESEND_WEBHOOK_BYTES) {
    return Response.json({ error: 'payload too large' }, { status: 413, headers: { 'cache-control': 'no-store' } });
  }
  const payload = await request.text();
  if (new TextEncoder().encode(payload).byteLength > MAX_RESEND_WEBHOOK_BYTES) {
    return Response.json({ error: 'payload too large' }, { status: 413, headers: { 'cache-control': 'no-store' } });
  }
  const result = await dispatch(payload, {
    id: request.headers.get('svix-id'),
    timestamp: request.headers.get('svix-timestamp'),
    signature: request.headers.get('svix-signature'),
  });
  return Response.json(result.body, { status: result.status, headers: { 'cache-control': 'no-store' } });
}
