import type { DomainEvent, EventType, Rule, Run, RunStatus } from './model.ts';

/** Everything the engine needs from the outside world. Real adapters: Postgres stores, pg-boss, an email sender, calls to the merchant cell. */
export interface RuleStore { rulesFor(storeId: string, trigger: EventType): Promise<Rule[]>; rule(storeId: string, ruleId: string): Promise<Rule | null> }
export interface EventStore { save(e: DomainEvent): Promise<void>; get(storeId: string, id: string): Promise<DomainEvent | null> }
export interface RunStore {
  /** Atomically creates the run. Returns false if a run with this idempotency key already exists (duplicate delivery). */
  insertIfAbsent(r: Run): Promise<boolean>;
  get(storeId: string, id: string): Promise<Run | null>;
  update(storeId: string, id: string, patch: Partial<Run>): Promise<void>;
  countSent(storeId: string, ruleId: string, recipient: string, since: Date): Promise<number>;
  countNonEssentialThisMonth(storeId: string, month: string): Promise<number>;
}
export interface ConsentPort { hasMarketingConsent(storeId: string, email: string): Promise<boolean> }
export interface SuppressionPort { isSuppressed(storeId: string, email: string): Promise<boolean> }
export interface StatePort { checkoutCompleted(storeId: string, checkoutId: string): Promise<boolean>; orderCancelled(storeId: string, orderId: string): Promise<boolean> }
export interface LimitsPort { automationRunsPerMonth(storeId: string): Promise<number>; quietHours(storeId: string): Promise<{ tz: string; from: number; to: number } | null> }
export interface SendRequest { storeId: string; template: string; to: string; audience: 'shopper' | 'merchant'; data: Record<string, unknown>; idempotencyKey: string; headers: Record<string, string> }
export interface Sender { send(r: SendRequest): Promise<{ messageId: string }> }
export interface ScheduledJob { storeId: string; runId: string; at: Date; attempt: number }
export interface Scheduler { schedule(job: ScheduledJob): Promise<void> }
export interface Clock { now(): Date }
export type { Run, RunStatus };
