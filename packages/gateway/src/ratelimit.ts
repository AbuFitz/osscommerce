import type { RateLimiter } from './ports.ts';
export class TokenBucket implements RateLimiter {
  private b = new Map<string, { t: number; at: number }>();
  private calls = 0;
  constructor(private capacity: number, private perSecond: number, private now: () => number = Date.now, private idleMs = 30 * 60_000, private maxKeys = 100_000) {}
  private prune(now: number) { for (const [key, state] of this.b) if (now - state.at > this.idleMs) this.b.delete(key); }
  take(key: string, cost = 1) {
    const n = this.now(); if (++this.calls % 1024 === 0 || (!this.b.has(key) && this.b.size >= this.maxKeys)) this.prune(n);
    if (!this.b.has(key) && this.b.size >= this.maxKeys) return false;
    const s = this.b.get(key) ?? { t: this.capacity, at: n };
    s.t = Math.min(this.capacity, s.t + ((n - s.at) / 1000) * this.perSecond); s.at = n;
    const ok = s.t >= cost; if (ok) s.t -= cost; this.b.set(key, s); return ok;
  }
}
