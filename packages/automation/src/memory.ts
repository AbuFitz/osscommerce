import type { DomainEvent, EventType, Rule, Run } from './model.ts';
import type { ConsentPort, EventStore, LimitsPort, RuleStore, RunStore, ScheduledJob, Scheduler, Sender, SendRequest, StatePort, SuppressionPort, Clock } from './ports.ts';

/** In-memory adapters for tests and local development. Same contracts as the Postgres adapters. */
export class MemRules implements RuleStore { constructor(public list: Rule[] = []) {}
  async rulesFor(storeId: string, trigger: EventType) { return this.list.filter(r => r.storeId === storeId && r.trigger === trigger); }
  async rule(storeId: string, id: string) { return this.list.find(r => r.storeId === storeId && r.id === id) ?? null; } }
export class MemEvents implements EventStore { m = new Map<string, DomainEvent>();
  async save(e: DomainEvent) { this.m.set(`${e.storeId}:${e.id}`, e); } async get(s: string, id: string) { return this.m.get(`${s}:${id}`) ?? null; } }
export class MemRuns implements RunStore { m = new Map<string, Run>(); keys = new Set<string>();
  async insertIfAbsent(r: Run) { if (this.keys.has(r.idempotencyKey)) return false; this.keys.add(r.idempotencyKey); this.m.set(r.id, r); return true; }
  async get(storeId: string, id: string) { const r = this.m.get(id); return r && r.storeId === storeId ? r : null; }
  async update(storeId: string, id: string, patch: Partial<Run>) { const r = this.m.get(id); if (r && r.storeId === storeId) this.m.set(id, { ...r, ...patch }); }
  async countSent(storeId: string, ruleId: string, recipient: string, since: Date) { return [...this.m.values()].filter(r => r.storeId === storeId && r.ruleId === ruleId && r.recipient === recipient && r.status === 'sent' && new Date(r.updatedAt) >= since).length; }
  async countNonEssentialThisMonth(storeId: string, _month: string) { return [...this.m.values()].filter(r => r.storeId === storeId && r.kind !== 'transactional' && r.status === 'sent').length; } }
export class MemConsent implements ConsentPort { yes = new Set<string>(); async hasMarketingConsent(s: string, e: string) { return this.yes.has(`${s}:${e}`); } }
export class MemSuppression implements SuppressionPort { set = new Set<string>(); async isSuppressed(s: string, e: string) { return this.set.has(`${s}:${e}`); } }
export class MemState implements StatePort { done = new Set<string>(); cancelled = new Set<string>();
  async checkoutCompleted(s: string, id: string) { return this.done.has(`${s}:${id}`); } async orderCancelled(s: string, id: string) { return this.cancelled.has(`${s}:${id}`); } }
export class MemLimits implements LimitsPort { constructor(public limit = 1000, public quiet: { tz: string; from: number; to: number } | null = null) {}
  async automationRunsPerMonth() { return this.limit; } async quietHours() { return this.quiet; } }
export class MemSender implements Sender { sent: SendRequest[] = []; failures: (Error | null)[] = [];
  async send(r: SendRequest) { const f = this.failures.shift(); if (f) throw f; this.sent.push(r); return { messageId: `msg_${this.sent.length}` }; } }
export class MemScheduler implements Scheduler { jobs: ScheduledJob[] = [];
  async schedule(job: ScheduledJob) { this.jobs.push(job); } }
export class FakeClock implements Clock { constructor(public t = new Date('2026-11-14T12:00:00Z')) {} now() { return new Date(this.t); } advance(ms: number) { this.t = new Date(this.t.getTime() + ms); } }
