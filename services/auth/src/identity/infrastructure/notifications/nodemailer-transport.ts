import { createTransport } from 'nodemailer';
import type { MailTransport, OutboundMessage } from './smtp-notification-sender';

export interface SmtpTransportConfig {
  readonly host: string;
  readonly port: number;
  /** Implicit TLS (port 465). When false the connection is upgraded via STARTTLS. */
  readonly secure: boolean;
  readonly username: string;
  readonly password: string;
}

export interface ClosableMailTransport extends MailTransport {
  close(): void;
}

const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 20_000;

/**
 * The only file that knows which SMTP library we use.
 *
 * `requireTLS` matters: without it nodemailer will happily continue in the
 * clear if a server omits STARTTLS, which would put the SMTP password and the
 * link secret on the wire in plaintext. With it, an un-upgradable connection
 * fails instead — and a failed send is recoverable, a leaked reset link is not.
 */
export function createSmtpTransport(config: SmtpTransportConfig): ClosableMailTransport {
  const transporter = createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.username, pass: config.password },
    pool: true,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
    tls: { minVersion: 'TLSv1.2' },
  });

  return {
    async sendMail(message: OutboundMessage): Promise<void> {
      await transporter.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
    close(): void {
      transporter.close();
    },
  };
}
