# FU-1 — Staging SMTP Verification Package

**Status:** 🟡 PREPARED, NOT EXECUTED. **Operator-run.**
**Prepared:** 2026-07-31 · **Covers:** the FU-1 criteria that cannot be automated in CI.

> **This document requests no credentials and contains no secrets, and no secret may be pasted into
> it.** Where a value is sensitive, the checklist asks for a *property* of it (for example "TLS 1.3",
> "chain valid") rather than the value. Anyone completing this fills it in from their own session
> with credentials they hold; nobody else needs to see them.
>
> Operational planning, not architecture documentation — repo root, no `docs/` file and no ADR is
> touched, so the [ADR-0023](docs/adr/ADR-0023-doc-freeze-and-approval-gate.md) freeze is intact.

---

## 1. What is already verified, and what this covers

Automated verification (`NEXUS_SMTP_TESTS=1`, in CI) exercises the **production** SMTP factory
against a real SMTP server and proves:

- it **refuses to send** when the server does not offer STARTTLS;
- **no credentials** are transmitted on that connection — AUTH is never reached;
- **no envelope and no message** are transmitted — MAIL FROM, RCPT TO and DATA never occur;
- neither the link secret nor the recipient appears on the wire;
- a control send with `requireTLS` disabled **succeeds** against the same server, which is what
  proves the refusal is caused by the production setting rather than by an unrelated failure.

What it **cannot** cover, and why: the factory validates certificates and does not set
`rejectUnauthorized: false`. Any server stood up in CI presents an untrusted certificate, so the
connection is correctly refused before AUTH. Exercising a **successful** send over TLS therefore
requires a certificate the runtime already trusts — which means a real provider. Weakening
production TLS to make a test pass would invert the priority, so that work lives here instead.

## 2. Procedure

Run against **staging**, never production. One provider is sufficient for FU-1 completion; run more
if the deployment will use more.

| # | Step | What to do |
|---|------|-----------|
| 1 | Choose a provider | Amazon SES, Mailgun, Postmark or Gmail. Record which |
| 2 | Configure the environment | Set `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT`, `MAIL_SMTP_SECURE`, `MAIL_SMTP_USERNAME`, `MAIL_SMTP_PASSWORD`, `MAIL_FROM_ADDRESS`, `APP_BASE_URL` in the staging secret store. **Enter these yourself; do not paste them into any chat, ticket or this file** |
| 3 | Confirm the boot gate | Start the service. It must start cleanly. Deliberately blank one mail variable and confirm it **refuses to boot** and names the missing variable |
| 4 | Negative TLS check | Point `MAIL_SMTP_PORT` at a plaintext port the provider exposes without STARTTLS, if one exists. The send must **fail**. Restore the correct port. Skip and mark `N/A` if the provider offers no such port |
| 5 | Password-reset send | Trigger `POST /v1/auth/password/reset-requests` for a mailbox you control |
| 6 | Email-verification send | Sign in and trigger `POST /v1/auth/email/verification-requests` for the same mailbox |
| 7 | UTF-8 check | Repeat step 5 for an account whose display name and local part contain non-ASCII characters (for example `zoë.ßtest@…`, and a name in Bengali or Japanese) |
| 8 | Inspect the raw message | In the mailbox, open the original/raw source of each message. Capture the headers listed in §4 |
| 9 | Follow both links | Click the reset link and the verification link. Each must load the app and be **consumed successfully**; a second use of the same link must fail |
| 10 | Record evidence | Complete §4 and attach the raw message source or screenshots with secrets redacted |

## 3. Operator checklist

Tick only what was observed. An unobserved item is `NOT VERIFIED`, never assumed.

- [ ] Service boots with mail configured
- [ ] Service **refuses to boot** with a mail variable missing, and names it
- [ ] Send over a non-STARTTLS port fails, or `N/A` for this provider
- [ ] Reset message delivered
- [ ] Verification message delivered
- [ ] TLS version recorded from the `Received` header
- [ ] Certificate chain valid — no browser or client warning, no manual trust override
- [ ] UTF-8 subject renders correctly in the mail client
- [ ] UTF-8 body renders correctly, including the display name
- [ ] Reset link renders correctly and is not line-wrapped or truncated
- [ ] Verification link renders correctly and is not line-wrapped or truncated
- [ ] Reset link consumed successfully
- [ ] Verification link consumed successfully
- [ ] Re-using either link fails
- [ ] Neither message body exposes anything beyond the intended link and copy
- [ ] Evidence attached with secrets redacted

## 4. Evidence template

Copy this block into the completion report and fill it in. **Redact hostnames, usernames and any
token values.**

```
FU-1 STAGING SMTP VERIFICATION
Date (UTC):
Operator:
Environment:                staging
Service commit:

PROVIDER
  Provider:                 [SES | Mailgun | Postmark | Gmail | other]
  Port / mode:              [587 STARTTLS | 465 implicit TLS]
  TLS version:              [from the Received header, e.g. TLS1_3]
  Cipher:                   [if reported]
  Certificate chain:        [valid | warning — describe]
  Trust override required:  [no | yes — if yes, FU-1 FAILS]

BOOT GATE
  Boots with mail configured:        [pass | fail]
  Refuses to boot when a var is absent: [pass | fail]
  Variable named in the error:       [yes | no]

NEGATIVE TLS CHECK
  Plaintext port tested:    [port | N/A — provider offers none]
  Send refused:             [pass | fail | N/A]

SMTP TRANSCRIPT SUMMARY
  (from provider logs; no credential values)
  EHLO accepted:            [yes | no]
  STARTTLS negotiated:      [yes | no]
  AUTH accepted:            [yes | no]
  MAIL FROM accepted:       [yes | no]
  RCPT TO accepted:         [yes | no]
  DATA accepted:            [yes | no]
  Provider message id:      [id]

DELIVERY
  Reset message sent at (UTC):
  Reset message received at (UTC):
  Verification message sent at (UTC):
  Verification message received at (UTC):
  Received headers:         [paste, redacting internal hostnames]

UTF-8
  Subject renders correctly:        [pass | fail]  Sample:
  Body renders correctly:           [pass | fail]  Sample:
  Non-ASCII display name correct:   [pass | fail]

LINK RENDERING
  Reset link intact and clickable:        [pass | fail]
  Verification link intact and clickable: [pass | fail]
  Link wrapped or truncated by the client:[no | yes — describe]

LINK CONSUMPTION
  Reset link consumed:              [pass | fail]
  Reset link rejected on reuse:     [pass | fail]
  Verification link consumed:       [pass | fail]
  Verification link rejected on reuse: [pass | fail]

ATTACHMENTS
  Raw message source (redacted):    [filename]
  Screenshots:                      [filenames]

RESULT
  FU-1 provider interoperability:   [VERIFIED | NOT VERIFIED]
  Notes / anomalies:
```

## 5. Completion criteria

FU-1 becomes **COMPLETE** only when all three hold:

1. at least one real hosted provider has been exercised successfully;
2. the §3 checklist is complete, with every unobserved item marked `NOT VERIFIED`;
3. the §4 evidence package has been reviewed.

Until then FU-1 stands at **PARTIALLY VERIFIED** — the fail-closed behaviour is proven automatically
in CI; provider interoperability is not.

## 6. Notes for whoever runs this

- **Do not** paste credentials into this file, a ticket, or a chat. Enter them directly into the
  staging secret store.
- **A trust override is a failure, not a workaround.** If the client or the runtime needs the
  certificate manually trusted, record it as a failure — production will hit the same wall.
- Gmail requires an app password with 2FA; SES requires the sending domain and the recipient to be
  verified while the account is in sandbox. Both are provider setup, not defects in this service.
- If a send fails, capture the provider's rejection code before retrying. The service reports one
  short reason with the link secret redacted, so the provider's log is the fuller record.
