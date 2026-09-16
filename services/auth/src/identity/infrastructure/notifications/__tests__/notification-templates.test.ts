import { describe, it, expect } from 'vitest';
import { renderNotification, actionLink } from '../notification-templates';
import type { IdentityNotification } from '../../../domain/ports/notification-sender';

const OPTIONS = { appBaseUrl: 'https://app.nexus.example', productName: 'NEXUS' };
const EXPIRES = new Date('2026-08-01T12:30:00.000Z');

function notification(
  kind: IdentityNotification['kind'],
  rawToken = 'tok-abc123',
): IdentityNotification {
  return { kind, to: 'jane@example.com', rawToken, expiresAt: EXPIRES };
}

describe('notification templates', () => {
  it('points each kind at its own path and carries the token as a query parameter', () => {
    expect(actionLink(notification('email_verification'), OPTIONS.appBaseUrl)).toBe(
      'https://app.nexus.example/verify-email?token=tok-abc123',
    );
    expect(actionLink(notification('password_reset'), OPTIONS.appBaseUrl)).toBe(
      'https://app.nexus.example/reset-password?token=tok-abc123',
    );
  });

  it('builds a correct link whether or not the base url has a trailing slash', () => {
    const n = notification('password_reset');
    expect(actionLink(n, 'https://app.nexus.example/')).toBe(
      actionLink(n, 'https://app.nexus.example'),
    );
  });

  it('percent-encodes a token containing url-significant characters', () => {
    const link = actionLink(notification('password_reset', 'a+b/c=d&e'), OPTIONS.appBaseUrl);
    expect(link).toContain('token=a%2Bb%2Fc%3Dd%26e');
    expect(link).not.toContain('&e=');
  });

  it('renders both a text and an html part, each containing the link', () => {
    const rendered = renderNotification(notification('email_verification'), OPTIONS);
    const link = actionLink(notification('email_verification'), OPTIONS.appBaseUrl);
    expect(rendered.subject).toBe('Confirm your email address');
    expect(rendered.text).toContain(link);
    expect(rendered.html).toContain(link);
    expect(rendered.html).toContain('<!doctype html>');
  });

  it('states an absolute expiry, so a queued message is not misleading', () => {
    const rendered = renderNotification(notification('password_reset'), OPTIONS);
    expect(rendered.text).toContain('2026-08-01 12:30 UTC');
  });

  /**
   * A reset mail is the one message an attacker can cause to land in someone
   * else's inbox. It must read as ignorable, never as an alarm.
   */
  it('tells a password-reset recipient that no action is needed if it was not them', () => {
    const rendered = renderNotification(notification('password_reset'), OPTIONS);
    expect(rendered.text).toContain('no action is needed');
    expect(rendered.text).toContain('your password has not changed');
  });

  it('escapes html so a hostile product name cannot inject markup', () => {
    const rendered = renderNotification(notification('email_verification'), {
      ...OPTIONS,
      productName: '<script>alert(1)</script>',
    });
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
  });
});
