import type { PgBoss } from 'pg-boss';
import type { Engine } from './engine.ts';
import type { ScheduledJob, Scheduler } from './ports.ts';

export const QUEUE = 'automation.run';

/** pg-boss as the durable timer. The engine owns retries and de-duplication (so every attempt is visible in the audit log),
 *  which means the queue only has to deliver each scheduled job once, at or after its due time. */
export class PgBossScheduler implements Scheduler {
  constructor(private boss: PgBoss) {}
  async schedule(j: ScheduledJob): Promise<void> {
    await this.boss.send(QUEUE, { storeId: j.storeId, runId: j.runId, attempt: j.attempt }, { startAfter: j.at, retryLimit: 0 });
  }
}

export interface WorkerOptions {
  /** Poll interval in seconds. Every poll is a query, so on a scale-to-zero database this keeps compute running. Run the worker on the always-on control-plane database only. */
  pollingIntervalSeconds?: number; batchSize?: number;
}
export async function startWorker(boss: PgBoss, engine: Engine, o: WorkerOptions = {}) {
  await boss.createQueue(QUEUE, { retryLimit: 0, expireInSeconds: 300, retentionSeconds: 7 * 24 * 3600 });
  return boss.work<{ storeId: string; runId: string; attempt: number }>(QUEUE, { pollingIntervalSeconds: o.pollingIntervalSeconds ?? 2, batchSize: o.batchSize ?? 5 }, async jobs => {
    for (const job of jobs) await engine.executeRun(job.data.storeId, job.data.runId);
  });
}
