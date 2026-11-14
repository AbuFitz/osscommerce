import { DomainEvent, PermanentError, TransientError, type Rule, type Run, type SkipReason } from './model.ts';
import type { Clock, ConsentPort, EventStore, LimitsPort, RuleStore, RunStore, Scheduler, Sender, StatePort, SuppressionPort } from './ports.ts';
import { deferOutOfQuietHours, idempotencyKey, matches, monthKey, nextRetryDelaySeconds } from './policy.ts';

export interface Deps {
  rules: RuleStore; events: EventStore; runs: RunStore; consent: ConsentPort; suppression: SuppressionPort; state: StatePort; limits: LimitsPort;
  sender: Sender; scheduler: Scheduler; clock: Clock; newId: () => string; jitter?: () => number;
  /** Base URL used to build the unsubscribe link on marketing email. */
  unsubscribeUrl: (storeId: string, email: string) => string;
  /** Override the retry schedule (seconds). For tests only. */
  retrySchedule?: readonly number[];
}

/** The automation engine: turns events into auditable, de-duplicated, consent-checked runs. Queue and storage are injected. */
export class Engine {
  constructor(private d: Deps) {}

  /** Entry point for every event. Safe to call repeatedly with the same event. Returns the runs created. */
  async handleEvent(raw: unknown): Promise<Run[]> {
    const e = DomainEvent.parse(raw);
    await this.d.events.save(e);
    const created: Run[] = [];
    for (const rule of await this.d.rules.rulesFor(e.storeId, e.type)) {
      if (!rule.enabled && rule.kind !== 'transactional') continue;           // transactional rules are always on
      if (!rule.conditions.every(c => matches(e, c))) continue;
      const to = rule.action.to === 'merchant' ? String(e.data['merchantEmail'] ?? '') : (e.recipient.email ?? '');
      const now = this.d.clock.now();
      let runAt = new Date(now.getTime() + rule.delaySeconds * 1000);
      if (rule.kind === 'marketing') runAt = deferOutOfQuietHours(runAt, await this.d.limits.quietHours(e.storeId));
      const run: Run = { id: this.d.newId(), storeId: e.storeId, ruleId: rule.id, ruleVersion: rule.version, kind: rule.kind, eventId: e.id, eventType: e.type,
        idempotencyKey: idempotencyKey(e.storeId, rule.id, e.id, to || 'none'), recipient: to || undefined, runAt: runAt.toISOString(), status: 'scheduled', attempts: [], createdAt: now.toISOString(), updatedAt: now.toISOString() };
      if (!(await this.d.runs.insertIfAbsent(run))) continue;                  // duplicate delivery: already handled
      await this.d.scheduler.schedule({ storeId: run.storeId, runId: run.id, at: runAt, attempt: 1 });
      created.push(run);
    }
    return created;
  }

  private async finish(run: Run, status: Run['status'], skip: SkipReason | undefined, detail: string, outcome: 'sent' | 'skipped', messageId?: string) {
    const now = this.d.clock.now().toISOString();
    await this.d.runs.update(run.storeId, run.id, { status, skipReason: skip, messageId, updatedAt: now, attempts: [...run.attempts, { at: now, outcome, detail }] });
  }

  /** Executes one run. Called by the queue worker when the run is due. Idempotent: a finished run is never executed again. */
  async executeRun(storeId: string, runId: string): Promise<void> {
    const run = await this.d.runs.get(storeId, runId); if (!run) return;
    if (run.status !== 'scheduled' && run.status !== 'failed_retrying') return;
    const rule = await this.d.rules.rule(run.storeId, run.ruleId); const event = await this.d.events.get(run.storeId, run.eventId);
    if (!rule || !event) return this.finish(run, 'failed', undefined, 'Rule or event no longer exists', 'skipped');
    const skip = async (reason: SkipReason, detail: string, status: Run['status'] = 'skipped') => this.finish(run, status, reason, detail, 'skipped');

    if (!rule.enabled && rule.kind !== 'transactional') return skip('rule_disabled', 'Turned off before it ran', 'cancelled');
    if (!run.recipient) return skip('no_recipient', 'No recipient address');
    if (await this.d.suppression.isSuppressed(run.storeId, run.recipient)) return skip('suppressed', 'Address is on the suppression list (bounce, complaint or unsubscribe)');
    if (rule.kind === 'marketing' && !(await this.d.consent.hasMarketingConsent(run.storeId, run.recipient))) return skip('no_consent', 'No current marketing consent');
    if (rule.guard === 'checkout_not_completed' && event.subject.checkoutId && await this.d.state.checkoutCompleted(run.storeId, event.subject.checkoutId)) return skip('guard_failed', 'Checkout was completed, so no reminder is needed', 'cancelled');
    if (rule.guard === 'order_not_cancelled' && event.subject.orderId && await this.d.state.orderCancelled(run.storeId, event.subject.orderId)) return skip('guard_failed', 'Order was cancelled', 'cancelled');
    if (rule.kind !== 'transactional') {
      const limit = await this.d.limits.automationRunsPerMonth(run.storeId);
      if (await this.d.runs.countNonEssentialThisMonth(run.storeId, monthKey(this.d.clock.now())) >= limit) return skip('limit_reached', `Monthly automation allowance of ${limit} reached`);
    }
    if (rule.throttle && await this.d.runs.countSent(run.storeId, rule.id, run.recipient, new Date(this.d.clock.now().getTime() - rule.throttle.windowSeconds * 1000)) >= rule.throttle.max) return skip('throttled', 'Recipient already received this recently');

    const headers: Record<string, string> = {};
    if (rule.kind === 'marketing') { const u = this.d.unsubscribeUrl(run.storeId, run.recipient); headers['List-Unsubscribe'] = `<${u}>`; headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'; }
    try {
      const r = await this.d.sender.send({ storeId: run.storeId, template: rule.action.template, to: run.recipient, audience: rule.action.to, data: { ...event.data, ...event.subject, eventType: event.type }, idempotencyKey: run.idempotencyKey, headers });
      await this.finish(run, 'sent', undefined, `Sent ${rule.action.template}`, 'sent', r.messageId);
    } catch (err) {
      const transient = err instanceof TransientError || !(err instanceof PermanentError);   // unknown errors are treated as transient
      const attemptsMade = run.attempts.length + 1; const now = this.d.clock.now();
      const delay = transient ? nextRetryDelaySeconds(attemptsMade, this.d.jitter?.() ?? 0, this.d.retrySchedule) : null;
      const msg = err instanceof Error ? err.message : String(err);
      if (delay === null) {
        await this.d.runs.update(run.storeId, run.id, { status: 'failed', updatedAt: now.toISOString(), attempts: [...run.attempts, { at: now.toISOString(), outcome: transient ? 'transient_error' : 'permanent_error', detail: transient ? `Gave up after ${attemptsMade} attempts: ${msg}` : msg }] });
        return;
      }
      await this.d.runs.update(run.storeId, run.id, { status: 'failed_retrying', updatedAt: now.toISOString(), attempts: [...run.attempts, { at: now.toISOString(), outcome: 'transient_error', detail: `${msg}. Retrying in ${delay}s (attempt ${attemptsMade + 1} of 6)` }] });
      await this.d.scheduler.schedule({ storeId: run.storeId, runId: run.id, at: new Date(now.getTime() + delay * 1000), attempt: attemptsMade + 1 });
    }
  }
}
