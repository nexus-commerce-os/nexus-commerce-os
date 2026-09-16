import type { RateLimitPolicy } from './rate-limit.guard';
import type { RateLimitSettings } from '../../config/identity-config';

/**
 * Endpoint thresholds — product policy, kept out of controllers so tuning never
 * means a code change at the call site.
 *
 * The network layer is looser than the fingerprint layer on purpose: one office
 * behind a NAT is many people sharing an address, while a fingerprint is closer
 * to one client. The subject layer is tighter still and exists for password
 * spraying, which the anonymous layers cannot see — many hosts, one account.
 *
 * Starting points, to be tuned against real traffic once there is any.
 */
export function defaultOperationPolicies(): RateLimitPolicy['operations'] {
  return {
    login: {
      network: { limit: 60, windowSeconds: 300 },
      fingerprint: { limit: 10, windowSeconds: 300 },
      subject: { limit: 5, windowSeconds: 900 },
      subjectField: 'email',
    },
    requestPasswordReset: {
      network: { limit: 20, windowSeconds: 3600 },
      fingerprint: { limit: 10, windowSeconds: 3600 },
      subject: { limit: 5, windowSeconds: 3600 },
      subjectField: 'email',
      // Throttled must look exactly like accepted, or the limiter becomes the
      // account-enumeration oracle the reset flow is designed to deny.
      silentDropStatus: 202,
    },
    requestEmailVerification: {
      network: { limit: 30, windowSeconds: 3600 },
      fingerprint: { limit: 5, windowSeconds: 3600 },
    },
    startPasskeyAuthentication: {
      network: { limit: 60, windowSeconds: 300 },
      fingerprint: { limit: 20, windowSeconds: 300 },
    },
    startOidcLogin: {
      network: { limit: 60, windowSeconds: 300 },
      fingerprint: { limit: 20, windowSeconds: 300 },
    },
  };
}

export function policyFrom(settings: RateLimitSettings): RateLimitPolicy {
  return {
    enabled: settings.enabled,
    trustedProxyHops: settings.trustedProxyHops,
    keySecret: settings.keySecret,
    operations: defaultOperationPolicies(),
  };
}
