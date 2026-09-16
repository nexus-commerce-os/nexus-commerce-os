import { describe, it, expect } from 'vitest';
import {
  SmtpNotificationSender,
  type MailTransport,
  type OutboundMessage,
} from '../smtp-notification-sender';
import type { IdentityNotification } from '../../../domain/ports/notification-sender';

const OPTIONS = {
  fromAddress: 'no-reply@nexus.example',
  fromName: 'NEXUS',
  appBaseUrl: 'https://app.nexus.example',
  productName: 'NEXUS',
};

const RAW_TOKEN = 'tok-secret-value';

const NOTIFICATION: IdentityNotification = {
  kind: 'password_reset',
  to: 'jane@example.com',
  rawToken: RAW_TOKEN,
  expiresAt: new Date('2026-08-01T12:30:00.000Z'),
};

/** A transport double — the only thing stubbed is the socket. */
class RecordingTransport implements MailTransport {
  readonly sent: OutboundMessage[] = [];
  constructor(private readonly failure?: unknown) {}
  async sendMail(message: OutboundMessage): Promise<void> {
    if (this.failure !== undefined) {
      throw this.failure;
    }
    this.sent.push(message);
  }
}

describe('SmtpNotificationSender', () => {
  it('sends a complete message with both parts and an RFC-shaped From', async () => {
    const transport = new RecordingTransport();
    const result = await new SmtpNotificationSender(transport, OPTIONS).send(NOTIFICATION);

    expect(result.ok).toBe(true);
    expect(transport.sent).toHaveLength(1);
    const message = transport.sent[0]!;
    expect(message.from).toBe('"NEXUS" <no-reply@nexus.example>');
    expect(message.to).toBe('jane@example.com');
    expect(message.subject).toBe('Reset your password');
    expect(message.text).toContain('https://app.nexus.example/reset-password?token=');
    expect(message.html).toContain('https://app.nexus.example/reset-password?token=');
  });

  it('escapes a display name so it cannot break out and inject a header', async () => {
    const transport = new RecordingTransport();
    await new SmtpNotificationSender(transport, {
      ...OPTIONS,
      fromName: 'Evil" <attacker@evil.example>\r\nBcc: victim@example.com',
    }).send(NOTIFICATION);

    const from = transport.sent[0]!.from;
    expect(from).not.toContain('\r');
    expect(from).not.toContain('\n');
    expect(from).toContain('Evil\\"');
    expect(from.endsWith('<no-reply@nexus.example>')).toBe(true);
  });

  it('returns a delivery error instead of throwing when the transport fails', async () => {
    const transport = new RecordingTransport(
      Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:587'), { code: 'ECONNREFUSED' }),
    );
    const result = await new SmtpNotificationSender(transport, OPTIONS).send(NOTIFICATION);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('NotificationDeliveryError');
      expect(result.error.kind).toBe('password_reset');
      expect(result.error.reason).toBe('ECONNREFUSED');
    }
  });

  /** The reason string is logged and may reach a response body. */
  it('never echoes the link secret or a stack trace in the failure reason', async () => {
    const leaky = new Error(`SMTP rejected message containing ${RAW_TOKEN}\n    at Socket.emit`);
    const result = await new SmtpNotificationSender(new RecordingTransport(leaky), OPTIONS).send(
      NOTIFICATION,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).not.toContain(RAW_TOKEN);
      expect(result.error.reason).toContain('[redacted]');
      expect(result.error.reason).not.toContain('at Socket.emit');
    }
  });

  it('describes a non-Error rejection without throwing', async () => {
    const result = await new SmtpNotificationSender(new RecordingTransport('boom'), OPTIONS).send(
      NOTIFICATION,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe('boom');
    }
  });
});
