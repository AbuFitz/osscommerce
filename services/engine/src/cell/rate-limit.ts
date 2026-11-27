import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserInputError } from '@vendure/core';
import { of } from 'rxjs';

/**
 * A fixed-window counter, per key. Lives in memory: a cell runs as one process, so this is exact for it, and a restart only ever forgives (never locks out).
 * Old windows are dropped as they expire so the map cannot grow without bound.
 */
export class Limiter {
  private hits = new Map<string, { n: number; until: number }>();
  constructor(private max: number, private windowMs: number, private now: () => number = Date.now) {}
  /** Counts one attempt. Returns the seconds to wait when the key is over its limit, otherwise 0. */
  hit(key: string): number {
    const t = this.now(); const h = this.hits.get(key);
    if (!h || h.until <= t) { this.hits.set(key, { n: 1, until: t + this.windowMs }); if (this.hits.size > 5000) this.sweep(t); return 0; }
    h.n++; return h.n > this.max ? Math.ceil((h.until - t) / 1000) : 0;
  }
  clear(key: string) { this.hits.delete(key); }
  private sweep(t: number) { for (const [k, v] of this.hits) if (v.until <= t) this.hits.delete(k); }
}

const MIN = 60_000;
/** Per person (the username they try) is the strong limit; per address is a wider, best-effort one, because a forwarded address can be forged. */
const BY_USER = new Limiter(10, 15 * MIN); const BY_ADDR = new Limiter(60, 15 * MIN); const BY_PASSWORD = new Limiter(5, 15 * MIN); const BY_RESET = new Limiter(3, 15 * MIN); const BY_REVIEW = new Limiter(25, 60 * MIN); const BY_VISIT = new Limiter(1200, 60 * MIN); const BY_REVIEW_EMAIL = new Limiter(12, 60 * MIN);
const wait = (s: number) => new UserInputError(`Too many attempts. Wait ${Math.ceil(s / 60)} minute${s > 60 ? 's' : ''} and try again.`);
const addr = (req: { headers?: Record<string, string | string[] | undefined>; ip?: string }) => String(req?.headers?.['x-forwarded-for'] ?? req?.ip ?? 'unknown').split(',')[0].trim();

/** Sign-in and password-change guesses are slowed down: a stolen-password list or a brute-force script gets a handful of tries, not millions. */
@Injectable()
export class RateLimit implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType<string>() !== 'graphql') return next.handle();
    const gql = GqlExecutionContext.create(context); const info = gql.getInfo(); const field: string = info.fieldName;
    if (info.parentType.name !== 'Mutation') return next.handle();
    const req = gql.getContext().req;
    if (field === 'login') { const u = String(gql.getArgs().username ?? '').trim().toLowerCase(); const s = Math.max(BY_USER.hit(`u:${u}`), BY_ADDR.hit(`a:${addr(req)}`)); if (s) throw wait(s); }
    if (field === 'changeMyPassword') { const s = BY_PASSWORD.hit(`p:${req?.user?.id ?? req?.session?.user?.id ?? addr(req)}`); if (s) throw wait(s); }
    if (field === 'requestStaffPasswordReset') { const e = String(gql.getArgs().email ?? '').trim().toLowerCase(); const s = Math.max(BY_RESET.hit(`r:${e}`), BY_ADDR.hit(`a:${addr(req)}`)); if (s) throw wait(s); }
    if (field === 'submitReview') { const i = gql.getArgs().input ?? {}; const s = Math.max(BY_REVIEW.hit(`v:${addr(req)}`), BY_REVIEW_EMAIL.hit(`e:${String(i.email ?? '').toLowerCase()}`)); if (s) throw wait(s); }
    if (field === 'trackVisit') { if (BY_VISIT.hit(`t:${addr(req)}`)) return of(true); return next.handle(); }   // over the limit: accepted and ignored, so a storefront page never has an error to handle
    if (field === 'acceptStaffToken') { const s = BY_ADDR.hit(`t:${addr(req)}`); if (s) throw wait(s); }
    return next.handle();
  }
}
