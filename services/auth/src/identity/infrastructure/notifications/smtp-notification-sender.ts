import { type Result, ok, err } from '../../../kernel/result';
import {
  NotificationDeliveryError,
  type IdentityNotification,
  type NotificationSender,
} from '../../domain/ports/notification-sender';
import { renderNotification } from './notification-templates';

/**
 * The narrowest slice of a mail client this adapter needs.
 *
 * Declaring it here rather than importing a vendor's `Transporter` keeps
 * nodemailer confined to {@link createSmtpTransport}: an API-based provider is
 * a different factory, not a different adapter.
 */
export interface MailTransport {
  sendMail(message: OutboundMessage): Promise<void>;
}

export interface OutboundMessage {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface SmtpSenderOptions {
  readonly fromAddress: string;
  readonly fromName: string;
  readonly appBaseUrl: string;
  readonly productName: string;
}

/**
 * Sends Identity notifications over SMTP.
 *
 * Every failure is returned, never thrown. The caller has already committed the
 * token this message would have carried, and that token stays valid — a bounced
 * send costs the user a second click on "resend", not a corrupted account.
 */
export class SmtpNotificationSender implements NotificationSender {
  constructor(
    private readonly transport: MailTransport,
    private readonly options: SmtpSenderOptions,
  ) {}

  async send(
    notification: IdentityNotification,
  ): Promise<Result<void, NotificationDeliveryError>> {
    const rendered = renderNotification(notification, {
      appBaseUrl: this.options.appBaseUrl,
      productName: this.options.productName,
    });

    try {
      await this.transport.sendMail({
        from: formatFrom(this.options.fromName, this.options.fromAddress),
        to: notification.to,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      return ok(undefined);
    } catch (cause) {
      return err(
        new NotificationDeliveryError(
          notification.kind,
          describeFailure(cause, notification.rawToken),
        ),
      );
    }
  }
}

/**
 * `"Name" <address>`, with quotes and backslashes escaped so a display name can
 * never break out of the quoted string and inject a second header.
 */
function formatFrom(name: string, address: string): string {
  const safe = name.replace(/[\\"]/g, '\\$&').replace(/[\r\n]/g, ' ');
  return `"${safe}" <${address}>`;
}

const MAX_REASON_LENGTH = 200;

/**
 * A short, loggable reason.
 *
 * Stack traces and any echo of the link secret are stripped: this string is
 * destined for logs and, via the problem-details mapper, potentially a
 * response body.
 */
function describeFailure(cause: unknown, rawToken: string): string {
  let reason = 'unknown transport failure';
  if (typeof cause === 'object' && cause !== null) {
    const code = (cause as { code?: unknown }).code;
    const message = (cause as { message?: unknown }).message;
    if (typeof code === 'string' && code.length > 0) {
      reason = code;
    } else if (typeof message === 'string' && message.length > 0) {
      reason = message;
    }
  } else if (typeof cause === 'string' && cause.length > 0) {
    reason = cause;
  }

  return reason
    .split('\n')[0]
    .replaceAll(rawToken, '[redacted]')
    .trim()
    .slice(0, MAX_REASON_LENGTH);
}
