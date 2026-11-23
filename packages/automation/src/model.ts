import { z } from 'zod';

/** Domain events emitted by a merchant's engine cell (or verified Stripe webhooks) into the automation service. */
export const EventType = z.enum([
  'order.paid', 'order.fulfilled', 'order.refunded', 'order.cancelled', 'payment.failed', 'stock.low',
  'checkout.started', 'checkout.completed', 'customer.password_reset_requested', 'order.unfulfilled_reminder_due',
]);
export type EventType = z.infer<typeof EventType>;

export const DomainEvent = z.object({
  id: z.string().min(8),                     // globally unique per event: the root of idempotency
  storeId: z.string(), type: EventType, occurredAt: z.string().datetime(),
  subject: z.object({ orderId: z.string().optional(), checkoutId: z.string().optional(), productId: z.string().optional() }).default({}),
  recipient: z.object({ email: z.string().email().optional(), name: z.string().optional() }).default({}),
  /** Snapshot taken when the event happened. The engine re-checks live consent before any marketing send. */
  consent: z.object({ marketing: z.boolean(), capturedAt: z.string().datetime().optional(), source: z.string().optional() }).default({ marketing: false }),
  data: z.record(z.string(), z.unknown()).default({}),
});
export type DomainEvent = z.infer<typeof DomainEvent>;

/** transactional: required for the shop to work, never needs consent, cannot be disabled.
 *  operational: sent to the merchant. marketing: promotional or reminder content to shoppers, needs consent and an unsubscribe. */
export const RuleKind = z.enum(['transactional', 'operational', 'marketing']);
export type RuleKind = z.infer<typeof RuleKind>;

export const Condition = z.object({ path: z.string(), op: z.enum(['eq', 'neq', 'gte', 'lte', 'in', 'exists']), value: z.unknown().optional() });
export type Condition = z.infer<typeof Condition>;

export const Action = z.object({ type: z.literal('send_email'), template: z.string(), to: z.enum(['shopper', 'merchant']) });
export type Action = z.infer<typeof Action>;

export const Rule = z.object({
  id: z.string(), storeId: z.string(), name: z.string(), version: z.number().int().positive().default(1),
  trigger: EventType, kind: RuleKind, enabled: z.boolean(),
  delaySeconds: z.number().int().nonnegative().default(0),
  conditions: z.array(Condition).default([]),
  /** Re-checked at send time, after any delay. */
  guard: z.enum(['checkout_not_completed', 'order_not_cancelled']).optional(),
  /** At most `max` sends per recipient per rule in `windowSeconds`. Marketing rules should always set one. */
  throttle: z.object({ max: z.number().int().positive(), windowSeconds: z.number().int().positive() }).optional(),
  action: Action,
});
export type Rule = z.infer<typeof Rule>;

export type SkipReason = 'rule_disabled' | 'no_consent' | 'suppressed' | 'guard_failed' | 'throttled' | 'limit_reached' | 'no_recipient' | 'duplicate' | 'conditions_not_met';
export type RunStatus = 'scheduled' | 'sent' | 'skipped' | 'failed_retrying' | 'failed' | 'cancelled';
export interface Attempt { at: string; outcome: 'sent' | 'skipped' | 'transient_error' | 'permanent_error'; detail: string }
export interface Run {
  id: string; storeId: string; ruleId: string; ruleVersion: number; kind: RuleKind; eventId: string; eventType: EventType;
  idempotencyKey: string; recipient?: string; runAt: string; status: RunStatus; skipReason?: SkipReason;
  attempts: Attempt[]; messageId?: string; createdAt: string; updatedAt: string;
}

/** Errors a sender raises so the engine knows whether retrying could ever help. */
export class TransientError extends Error { readonly transient = true; }
export class PermanentError extends Error { readonly transient = false; }
