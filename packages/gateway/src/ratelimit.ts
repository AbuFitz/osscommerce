import type { RateLimiter } from './ports.ts';
export class TokenBucket implements RateLimiter {
  private b = new Map<string, { t: number; at: number }>();
  constructor(private capacity: number, private perSecond: number, private now: () => number = Date.now) {}
  take(key: string, cost = 1) {
    const n = this.now(), s = this.b.get(key) ?? { t: this.capacity, at: n };
    s.t = Math.min(this.capacity, s.t + ((n - s.at) / 1000) * this.perSecond); s.at = n;
    const ok = s.t >= cost; if (ok) s.t -= cost; this.b.set(key, s); return ok;
  }
}
