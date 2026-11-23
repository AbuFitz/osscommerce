import { Resend } from 'resend';
import { z } from 'zod';
import { PermanentError, TransientError } from './model.ts';
import type { SendRequest, Sender } from './ports.ts';

const Prepared = z.object({
  from: z.string().min(3).max(320),
  subject: z.string().trim().min(1).max(998),
  html: z.string().min(1),
  text: z.string().min(1).optional(),
  replyTo: z.string().email().optional(),
});
export type PreparedEmail = z.infer<typeof Prepared>;

export interface ResendClient {
  emails: {
    send(
      message: PreparedEmail & { to: string; headers: Record<string, string> },
      options: { idempotencyKey: string },
    ): Promise<{ data: { id: string } | null; error: { name?: string; message?: string; statusCode?: number } | null }>;
  };
  webhooks: {
    verify(input: {
      payload: string;
      headers: { id: string; timestamp: string; signature: string };
      webhookSecret: string;
    }): unknown;
  };
}

export interface ResendSenderOptions {
  apiKey: string;
  /** Resolves the store's verified sender/brand and renders the requested immutable template. */
  prepare(request: SendRequest): Promise<PreparedEmail>;
  client?: ResendClient;
}

const placeholder = /(?:placeholder|change[-_ ]?me|replace|example|dummy|fake|todo)/i;

function providerError(error: { name?: string; message?: string; statusCode?: number }): Error {
  const status = error.statusCode ?? 0;
  const name = error.name ?? 'resend_error';
  const detail = `${name}: ${error.message ?? 'Resend rejected the email'}`;
  const retryable = name === 'concurrent_idempotent_requests' || status === 408 || status === 429 || status >= 500;
  return retryable ? new TransientError(detail) : new PermanentError(detail);
}

/** Production Resend adapter. Provider idempotency complements the database run guard when a response is lost. */
export class ResendSender implements Sender {
  private readonly client: ResendClient;
  constructor(private readonly options: ResendSenderOptions) {
    if (!/^re_[A-Za-z0-9_-]{20,}$/.test(options.apiKey) || placeholder.test(options.apiKey)) {
      throw new Error('A real RESEND_API_KEY is required');
    }
    this.client = options.client ?? (new Resend(options.apiKey) as unknown as ResendClient);
  }

  async send(request: SendRequest): Promise<{ messageId: string }> {
    const email = Prepared.parse(await this.options.prepare(request));
    const key = request.idempotencyKey.slice(0, 256);
    if (!key) throw new PermanentError('Email idempotency key is missing');
    const result = await this.client.emails.send(
      { ...email, to: request.to, headers: request.headers },
      { idempotencyKey: key },
    );
    if (result.error) throw providerError(result.error);
    if (!result.data?.id) throw new TransientError('Resend returned no email id');
    return { messageId: result.data.id };
  }
}

export interface ResendWebhookHeaders { id?: string | null; timestamp?: string | null; signature?: string | null }

/** Verifies the raw request before parsing it. Callers must never re-serialize a parsed JSON body. */
export function verifyResendWebhook(client: Pick<ResendClient, 'webhooks'>, payload: string, headers: ResendWebhookHeaders, webhookSecret: string): unknown {
  if (!/^whsec_[A-Za-z0-9_-]{12,}$/.test(webhookSecret) || placeholder.test(webhookSecret)) throw new Error('A real RESEND_WEBHOOK_SECRET is required');
  if (!headers.id || !headers.timestamp || !headers.signature) throw new PermanentError('Missing Resend webhook signature headers');
  try {
    return client.webhooks.verify({ payload, headers: { id: headers.id, timestamp: headers.timestamp, signature: headers.signature }, webhookSecret });
  } catch {
    throw new PermanentError('Invalid Resend webhook signature');
  }
}

export type SuppressionReason = 'bounce' | 'complaint' | 'unsubscribe';

/** Only events that must prevent future mail become local suppressions; delivery/open/click events are observational. */
export function suppressionFromResendEvent(event: unknown): { email: string; reason: SuppressionReason } | null {
  const parsed = z.object({
    type: z.string(),
    data: z.object({ to: z.array(z.string().email()).optional(), email: z.string().email().optional(), unsubscribed: z.boolean().optional() }).passthrough(),
  }).safeParse(event);
  if (!parsed.success) return null;
  const email = parsed.data.data.email ?? parsed.data.data.to?.[0];
  if (!email) return null;
  if (parsed.data.type === 'email.bounced' || parsed.data.type === 'email.suppressed') return { email, reason: 'bounce' };
  if (parsed.data.type === 'email.complained') return { email, reason: 'complaint' };
  if (parsed.data.type === 'contact.updated' && parsed.data.data.unsubscribed) return { email, reason: 'unsubscribe' };
  return null;
}
