import { Injectable, Inject, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { RATE_LIMIT_POLICY, RATE_LIMITER, RATE_LIMIT_OBSERVER } from '../tokens';
import type { RateLimiter, RateLimitObserver, RateLimitRule } from './rate-limiter';
import { fingerprintKey, networkKey, resolveClientAddress, subjectKey } from './client-address';

/**
 * What is protected, and how. Supplied by configuration — thresholds are
 * product policy and must never be hardcoded at the call site.
 */
export interface RateLimitPolicy {
  readonly enabled: boolean;
  readonly trustedProxyHops: number;
  /** Server-side secret for the hashed keys. Never the raw address or email. */
  readonly keySecret: string;
  readonly operations: Readonly<Record<string, OperationPolicy>>;
}

export interface OperationPolicy {
  readonly network: RateLimitRule;
  readonly fingerprint: RateLimitRule;
  /** Optional third layer, keyed on a hashed submitted identifier. */
  readonly subject?: RateLimitRule;
  /** Body field holding that identifier, when `subject` is configured. */
  readonly subjectField?: string;
  /**
   * When set, a rejection is answered with this status and an empty body
   * instead of 429 — and with no `Retry-After`.
   *
   * Used for password-reset requests. A 429 there would tell a prober which
   * addresses exist, undoing the anti-enumeration work the reset flow is built
   * around: unknown addresses could be submitted forever while real ones began
   * to throttle. Being throttled must look exactly like succeeding.
   */
  readonly silentDropStatus?: number;
}

/** Thrown when a caller is over the limit and may be told so. */
export class RateLimitedError extends Error {
  readonly _tag = 'RateLimitedError';
  constructor(public readonly retryAfterSeconds: number) {
    super('Too many requests.');
    this.name = 'RateLimitedError';
  }
}

/** Thrown when a caller is over the limit and may *not* be told so. */
export class SilentlyDroppedError extends Error {
  readonly _tag = 'SilentlyDroppedError';
  constructor(public readonly status: number) {
    super('Request dropped.');
    this.name = 'SilentlyDroppedError';
  }
}

/**
 * Abuse protection at the HTTP edge.
 *
 * Runs before {@link SessionAuthGuard} wherever both apply, so an
 * unauthenticated flood cannot force session lookups. Layers are checked
 * cheapest-first and every configured layer must pass.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    @Inject(RATE_LIMIT_POLICY) private readonly policy: RateLimitPolicy,
    @Inject(RATE_LIMIT_OBSERVER) private readonly observer: RateLimitObserver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const operation = operationOf(context);
    const rules = this.policy.operations[operation];
    if (!this.policy.enabled || rules === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const address = resolveClientAddress(
      request.socket.remoteAddress,
      headerOf(request, 'x-forwarded-for'),
      this.policy.trustedProxyHops,
    );

    const layers: { name: string; key: string; rule: RateLimitRule }[] = [
      { name: 'network', key: `${operation}:net:${networkKey(address)}`, rule: rules.network },
      {
        name: 'fingerprint',
        key: `${operation}:fp:${fingerprintKey(address, headerOf(request, 'user-agent'), this.policy.keySecret)}`,
        rule: rules.fingerprint,
      },
    ];

    const submitted = this.submittedIdentifier(request, rules);
    if (rules.subject !== undefined && submitted !== null) {
      layers.push({
        name: 'subject',
        key: `${operation}:sub:${subjectKey(submitted, this.policy.keySecret)}`,
        rule: rules.subject,
      });
    }

    for (const layer of layers) {
      const decision = await this.limiter.consume(layer.key, layer.rule);
      this.observer.onDecision({
        operation,
        layer: layer.name,
        allowed: decision.allowed,
        degraded: decision.degraded,
      });

      if (!decision.allowed) {
        if (rules.silentDropStatus !== undefined) {
          throw new SilentlyDroppedError(rules.silentDropStatus);
        }
        throw new RateLimitedError(decision.retryAfterSeconds);
      }
    }

    return true;
  }

  /**
   * Read the identifier from the body as submitted — never from a lookup.
   * Consulting the user repository to decide whether to count would make the
   * limiter's own behaviour depend on whether an account exists.
   */
  private submittedIdentifier(request: Request, rules: OperationPolicy): string | null {
    if (rules.subjectField === undefined) {
      return null;
    }
    const body: unknown = request.body;
    if (typeof body !== 'object' || body === null) {
      return null;
    }
    const value = (body as Record<string, unknown>)[rules.subjectField];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}

/** Rate limits are declared per operation id, matching the OpenAPI contract. */
export const RATE_LIMITED_OPERATION = Symbol('RATE_LIMITED_OPERATION');

function operationOf(context: ExecutionContext): string {
  return (
    (Reflect.getMetadata(RATE_LIMITED_OPERATION, context.getHandler()) as string | undefined) ?? ''
  );
}

function headerOf(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
