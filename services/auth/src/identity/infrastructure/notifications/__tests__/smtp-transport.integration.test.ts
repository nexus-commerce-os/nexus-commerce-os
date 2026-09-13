import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SMTPServer } from 'smtp-server';
import { createTransport } from 'nodemailer';
import type { AddressInfo } from 'node:net';
import { createSmtpTransport } from '../nodemailer-transport';
import { SmtpNotificationSender } from '../smtp-notification-sender';
import type { IdentityNotification } from '../../../domain/ports/notification-sender';

/**
 * FU-1 — the production SMTP factory against a real SMTP server.
 *
 * Everything else in this suite talks to a transport double, which can prove
 * what we intended to send but nothing about the wire. This exercises
 * `createSmtpTransport` itself over a genuine SMTP dialogue.
 *
 * **What this cannot cover, and why.** The factory validates certificates and
 * does not set `rejectUnauthorized: false`. Any server we can stand up in CI
 * presents an untrusted certificate, so the connection is refused before AUTH —
 * correctly. Exercising MAIL FROM / RCPT TO / DATA over TLS therefore needs a
 * certificate the runtime already trusts, which means a real provider. That is
 * the staging package, not this file. Weakening production TLS to make a test
 * pass would invert the priority.
 *
 * Enforced in CI (`NEXUS_SMTP_TESTS=1`), skipped elsewhere rather than silently
 * passing.
 */
const SMTP_TESTS_ENABLED = process.env['NEXUS_SMTP_TESTS'] === '1';

const CREDENTIALS = { username: 'mailer', password: 'test-only-smtp-password' };
const SECRET_TOKEN = 'tok-secret-that-must-never-reach-the-wire';

const NOTIFICATION: IdentityNotification = {
  kind: 'password_reset',
  to: 'jane@example.com',
  rawToken: SECRET_TOKEN,
  expiresAt: new Date('2026-08-01T12:30:00.000Z'),
};

/** Every command the server was asked to perform, in order. */
interface Dialogue {
  commands: string[];
  authAttempts: number;
  recipients: string[];
  messages: string[];
}

describe.skipIf(!SMTP_TESTS_ENABLED)('production SMTP factory against a real server', () => {
  let server: SMTPServer;
  let port: number;
  let dialogue: Dialogue;

  beforeAll(async () => {
    dialogue = { commands: [], authAttempts: 0, recipients: [], messages: [] };

    // A server that speaks real SMTP and, like a misconfigured relay, offers no
    // STARTTLS. `hideSTARTTLS` is what makes this the scenario that matters.
    server = new SMTPServer({
      hideSTARTTLS: true,
      authOptional: false,
      onConnect: (_session, callback) => {
        dialogue.commands.push('CONNECT');
        callback();
      },
      onAuth: (auth, _session, callback) => {
        dialogue.commands.push('AUTH');
        dialogue.authAttempts += 1;
        callback(null, { user: auth.username });
      },
      onMailFrom: (address, _session, callback) => {
        dialogue.commands.push(`MAIL FROM:${address.address}`);
        callback();
      },
      onRcptTo: (address, _session, callback) => {
        dialogue.commands.push(`RCPT TO:${address.address}`);
        dialogue.recipients.push(address.address);
        callback();
      },
      onData: (stream, _session, callback) => {
        dialogue.commands.push('DATA');
        let body = '';
        stream.on('data', (chunk: Buffer) => {
          body += chunk.toString('utf8');
        });
        stream.on('end', () => {
          dialogue.messages.push(body);
          callback();
        });
      },
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(resolve));
  });

  async function attemptSend(): Promise<{ ok: boolean; reason: string }> {
    const transport = createSmtpTransport({
      host: '127.0.0.1',
      port,
      secure: false,
      username: CREDENTIALS.username,
      password: CREDENTIALS.password,
    });
    const sender = new SmtpNotificationSender(transport, {
      fromAddress: 'no-reply@nexus.example',
      fromName: 'NEXUS',
      appBaseUrl: 'https://app.nexus.example',
      productName: 'NEXUS',
    });

    try {
      const result = await sender.send(NOTIFICATION);
      return result.ok ? { ok: true, reason: '' } : { ok: false, reason: result.error.reason };
    } finally {
      transport.close();
    }
  }

  /**
   * The property the whole increment turns on. Without `requireTLS`, nodemailer
   * continues in the clear when a server omits STARTTLS — putting the SMTP
   * password and the reset link on the wire. A failed send is recoverable; a
   * leaked reset link is not.
   */
  it('refuses to send when the server does not offer STARTTLS', async () => {
    const attempt = await attemptSend();

    expect(attempt.ok, 'the factory sent over an unencrypted connection').toBe(false);
    expect(attempt.reason.length).toBeGreaterThan(0);
  });

  /**
   * The control. "It failed" is weak evidence on its own — a misconfigured
   * server or a bad credential would fail too, and the suite would still look
   * green while proving nothing about TLS.
   *
   * This sends the same message to the same server with `requireTLS` off, in
   * test-only code, and expects it to *succeed*. That establishes the server is
   * perfectly willing to accept the message in the clear, so the refusal above
   * is caused by the production setting and by nothing else.
   */
  it('would have sent in the clear without requireTLS — isolating the cause', async () => {
    // Its own server and its own recorder: the assertions below are about a
    // send that *succeeds*, and mixing them into the shared dialogue would
    // contaminate the "never happened" evidence the other tests depend on.
    const control: Dialogue = { commands: [], authAttempts: 0, recipients: [], messages: [] };
    const controlServer = new SMTPServer({
      hideSTARTTLS: true,
      authOptional: false,
      onAuth: (auth, _session, callback) => {
        control.commands.push('AUTH');
        callback(null, { user: auth.username });
      },
      onMailFrom: (_address, _session, callback) => {
        control.commands.push('MAIL FROM');
        callback();
      },
      onRcptTo: (address, _session, callback) => {
        control.commands.push('RCPT TO');
        control.recipients.push(address.address);
        callback();
      },
      onData: (stream, _session, callback) => {
        control.commands.push('DATA');
        stream.on('data', () => undefined);
        stream.on('end', callback);
      },
    });

    await new Promise<void>((resolve) => controlServer.listen(0, '127.0.0.1', resolve));
    const controlPort = (controlServer.server.address() as AddressInfo).port;

    const insecure = createTransport({
      host: '127.0.0.1',
      port: controlPort,
      secure: false,
      requireTLS: false,
      auth: { user: CREDENTIALS.username, pass: CREDENTIALS.password },
    });

    try {
      const info = await insecure.sendMail({
        from: 'no-reply@nexus.example',
        to: 'control@example.com',
        subject: 'control',
        text: 'control',
      });
      expect(info.accepted).toContain('control@example.com');
    } finally {
      insecure.close();
      await new Promise<void>((resolve) => controlServer.close(resolve));
    }

    // The control reached AUTH and DATA — exactly what the production factory
    // refused to do against an identical server.
    expect(control.commands).toContain('AUTH');
    expect(control.commands).toContain('DATA');
    expect(control.recipients).toContain('control@example.com');
  });

  it('reached the server and negotiated as far as the secure boundary', async () => {
    // The dialogue got far enough to learn the server's capabilities — which is
    // exactly how it discovered STARTTLS was missing — and no further.
    expect(dialogue.commands).toContain('CONNECT');
  });

  /** No credentials may cross an unencrypted connection. */
  it('never attempted authentication', () => {
    expect(dialogue.authAttempts).toBe(0);
    expect(dialogue.commands).not.toContain('AUTH');
  });

  it('never began an envelope or a message', () => {
    expect(dialogue.commands.some((c) => c.startsWith('MAIL FROM'))).toBe(false);
    expect(dialogue.commands.some((c) => c.startsWith('RCPT TO'))).toBe(false);
    expect(dialogue.commands).not.toContain('DATA');
    expect(dialogue.recipients).toEqual([]);
    expect(dialogue.messages).toEqual([]);
  });

  /**
   * The strongest form of the assertion: whatever else happened, the link
   * secret and the recipient never appeared on the wire.
   */
  it('transmitted neither the link secret nor the recipient', () => {
    const wire = dialogue.messages.join('\n');
    expect(wire).not.toContain(SECRET_TOKEN);
    expect(wire).not.toContain('jane@example.com');
    expect(wire).not.toContain(CREDENTIALS.password);
  });
});

/**
 * A skipped suite reports green, so the gate itself is asserted — the same
 * false-green trap the Postgres and Redis suites guard against.
 */
describe('SMTP suite gate', () => {
  it('is enabled in CI', () => {
    if (process.env['CI'] === 'true') {
      expect(
        SMTP_TESTS_ENABLED,
        'NEXUS_SMTP_TESTS must be 1 in CI, or the SMTP factory is never exercised',
      ).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });
});
