import type { IdentityNotification } from '../../domain/ports/notification-sender';

/** A rendered message, ready for any transport that can carry text and HTML. */
export interface RenderedNotification {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface TemplateOptions {
  /** Origin the action links point at, e.g. `https://app.nexus.example`. */
  readonly appBaseUrl: string;
  /** Shown in copy so the reader can tell a real message from a lookalike. */
  readonly productName: string;
}

/** Where each link lands in the web app. */
const PATH_BY_KIND: Record<IdentityNotification['kind'], string> = {
  email_verification: '/verify-email',
  password_reset: '/reset-password',
};

export function actionLink(
  notification: IdentityNotification,
  appBaseUrl: string,
): string {
  const url = new URL(PATH_BY_KIND[notification.kind], withTrailingSlash(appBaseUrl));
  url.searchParams.set('token', notification.rawToken);
  return url.toString();
}

/**
 * Renders a notification into subject/text/html.
 *
 * Both flows state the expiry and say plainly what to do if the request was not
 * theirs: a reset mail is the one message an attacker can cause to arrive in a
 * victim's inbox, so it must never imply the account is already compromised or
 * that any action is required (docs/08 threat X7).
 */
export function renderNotification(
  notification: IdentityNotification,
  options: TemplateOptions,
): RenderedNotification {
  const link = actionLink(notification, options.appBaseUrl);
  const expiry = formatExpiry(notification.expiresAt);
  const product = options.productName;

  if (notification.kind === 'email_verification') {
    return compose({
      subject: `Confirm your email address`,
      heading: `Confirm your email address`,
      body: [
        `Confirm this address to finish setting up your ${product} account.`,
        `The link expires ${expiry}. If it does, request a new one — old links stop working.`,
        `If you did not create a ${product} account, ignore this message and nothing happens.`,
      ],
      cta: 'Confirm email address',
      link,
      product,
    });
  }

  return compose({
    subject: `Reset your password`,
    heading: `Reset your password`,
    body: [
      `Someone asked to reset the password for the ${product} account using this address.`,
      `The link expires ${expiry} and can be used once.`,
      `If this was not you, no action is needed — your password has not changed and this link can simply be ignored.`,
    ],
    cta: 'Choose a new password',
    link,
    product,
  });
}

interface Composition {
  readonly subject: string;
  readonly heading: string;
  readonly body: readonly string[];
  readonly cta: string;
  readonly link: string;
  readonly product: string;
}

function compose(c: Composition): RenderedNotification {
  const text = [...c.body, '', c.cta, c.link, '', `— ${c.product}`].join('\n');

  const paragraphs = c.body.map((line) => `      <p style="${P}">${escapeHtml(line)}</p>`).join('\n');

  // Inlined styles and a table-free layout: mail clients strip <style> blocks,
  // and the plain-text part above stays authoritative for anything that cannot
  // render HTML at all.
  const html = [
    `<!doctype html>`,
    `<html lang="en">`,
    `  <body style="${BODY}">`,
    `    <div style="${CARD}">`,
    `      <h1 style="${H1}">${escapeHtml(c.heading)}</h1>`,
    paragraphs,
    `      <p style="${P}"><a href="${escapeAttribute(c.link)}" style="${BUTTON}">${escapeHtml(c.cta)}</a></p>`,
    `      <p style="${MUTED}">If the button does not work, paste this into your browser:<br />${escapeHtml(c.link)}</p>`,
    `      <p style="${MUTED}">— ${escapeHtml(c.product)}</p>`,
    `    </div>`,
    `  </body>`,
    `</html>`,
  ].join('\n');

  return { subject: c.subject, text, html };
}

const BODY = 'margin:0;padding:24px;background:#f5f7f4;font-family:system-ui,Segoe UI,Arial,sans-serif;';
const CARD = 'max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dce3dd;border-radius:14px;padding:32px;';
const H1 = 'margin:0 0 16px;font-size:20px;line-height:1.3;color:#111a16;';
const P = 'margin:0 0 16px;font-size:15px;line-height:1.6;color:#111a16;';
const MUTED = 'margin:0 0 12px;font-size:13px;line-height:1.6;color:#586460;word-break:break-all;';
const BUTTON =
  'display:inline-block;background:#0e9f6e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:15px;';

function withTrailingSlash(base: string): string {
  return base.endsWith('/') ? base : `${base}/`;
}

/**
 * Absolute, in UTC with the zone named. A recipient in another zone can still
 * tell whether the link is live, which a bare "in 30 minutes" cannot do once
 * the message has sat in a queue.
 */
function formatExpiry(at: Date): string {
  const stamp = at.toISOString().replace('T', ' ').slice(0, 16);
  return `on ${stamp} UTC`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
