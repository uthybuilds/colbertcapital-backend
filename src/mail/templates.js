/**
 * Transactional email templates.
 *
 * Rules for inbox compatibility:
 *  - table-based layout, no flex/grid
 *  - every style inlined (Gmail strips <style> in some contexts)
 *  - the emblem is drawn in HTML/CSS, no external image required (SVG is
 *    unsupported by Outlook and blocked by default in most clients)
 */

const NAVY = '#17376b'
const GOLD = '#f4d362'
const CREAM = '#f7f3ec'
const INK = '#16284a'
const MUTED = '#61748f'
const HAIRLINE = '#e4dccd'

const SERIF = "Georgia, 'Times New Roman', Times, serif"
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

function emblem(size = 44) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 14px;">
      <tr>
        <td align="center" width="${size}" height="${size}"
            style="width:${size}px;height:${size}px;background:${GOLD};border-radius:${size / 2}px;
                   font-family:${SERIF};font-size:${Math.round(size * 0.5)}px;line-height:${size}px;
                   color:${NAVY};font-weight:bold;letter-spacing:-1px;">C</td>
      </tr>
    </table>
  `
}

function layout({ preheader, eyebrow, title, intro, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;color:${CREAM};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:18px;overflow:hidden;">

          <tr>
            <td align="center" style="background:${NAVY};padding:34px 32px 30px;">
              ${emblem()}
              <div style="font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:3px;
                          text-transform:uppercase;color:${GOLD};">Colbert Capital</div>
              <div style="font-family:${SERIF};font-size:13px;color:#b9c6dd;margin-top:8px;letter-spacing:0.3px;">
                Private investment management
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:38px 36px 8px;">
              <div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:2.4px;
                          text-transform:uppercase;color:${MUTED};">${eyebrow}</div>
              <h1 style="margin:14px 0 0;font-family:${SERIF};font-size:27px;line-height:1.25;
                         color:${NAVY};font-weight:normal;letter-spacing:-0.4px;">${title}</h1>
              <p style="margin:16px 0 0;font-family:${SANS};font-size:15px;line-height:1.7;color:#41566f;">
                ${intro}
              </p>
            </td>
          </tr>

          ${body}

          <tr>
            <td style="padding:8px 36px 36px;">
              <div style="border-top:1px solid ${HAIRLINE};padding-top:22px;">
                <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.7;color:${MUTED};">
                  This message was sent by Colbert Capital. If you did not request it, you can safely ignore it —
                  no action will be taken on your account.
                </p>
                <p style="margin:14px 0 0;font-family:${SANS};font-size:12px;line-height:1.7;color:${MUTED};">
                  Colbert Capital &middot; Client Services &middot;
                  <a href="mailto:info@colbertcapital.org" style="color:${NAVY};text-decoration:none;">info@colbertcapital.org</a>
                </p>
                <p style="margin:14px 0 0;font-family:${SANS};font-size:11px;line-height:1.6;color:#93a3b8;">
                  Never share this code with anyone. Colbert Capital will never ask you for it by phone, chat or email.
                </p>
              </div>
            </td>
          </tr>

        </table>

        <div style="max-width:600px;margin:18px auto 0;font-family:${SANS};font-size:11px;color:#93a3b8;text-align:center;">
          &copy; ${new Date().getFullYear()} Colbert Capital. All rights reserved.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Large, letter-spaced code block. */
function codeBlock(code, label) {
  return `
    <tr>
      <td align="center" style="padding:26px 36px 6px;">
        <div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:2.2px;
                    text-transform:uppercase;color:${MUTED};padding-bottom:12px;">${label}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center" style="background:${CREAM};border:1px solid ${HAIRLINE};border-radius:14px;padding:22px 16px;">
              <div style="font-family:${SERIF};font-size:40px;line-height:1;color:${NAVY};
                          letter-spacing:12px;font-weight:bold;">${code}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
}

function metaRow(label, value) {
  return `
    <tr>
      <td style="font-family:${SANS};font-size:12px;color:${MUTED};padding:4px 0;">${label}</td>
      <td align="right" style="font-family:${SANS};font-size:12px;color:${INK};padding:4px 0;">${value}</td>
    </tr>`
}

function metaPanel(rows) {
  return `
    <tr>
      <td style="padding:22px 36px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:#fbfaf7;border:1px solid ${HAIRLINE};border-radius:12px;padding:16px 18px;">
          ${rows}
        </table>
      </td>
    </tr>`
}

export function renderVerificationEmail({ firstName = 'there', code, expiresInMinutes = 10 }) {
  return {
    subject: 'Verify your Colbert Capital email address',
    html: layout({
      preheader: `Your verification code is ${code}. It expires in ${expiresInMinutes} minutes.`,
      eyebrow: 'Account verification',
      title: `Confirm your email, ${firstName}.`,
      intro:
        'Enter the code below to activate your Colbert Capital account. This code is valid for a single use and expires shortly.',
      body:
        codeBlock(code, 'Your verification code') +
        metaPanel(
          metaRow('Valid for', `${expiresInMinutes} minutes`) + metaRow('Use', 'One time only'),
        ),
    }),
  }
}

export function renderLoginOtpEmail({
  firstName = 'there',
  code,
  expiresInMinutes = 10,
  ipAddress,
  userAgent,
  when = new Date(),
}) {
  const rows = [
    metaRow('Valid for', `${expiresInMinutes} minutes`),
    metaRow(
      'Requested',
      when.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) +
        ' UTC',
    ),
  ]
  // Only the network prefix is ever recorded, so it is labelled as such.
  if (ipAddress) rows.push(metaRow('Network', ipAddress))
  if (userAgent) {
    const trimmed = String(userAgent).slice(0, 46)
    rows.push(metaRow('Device', trimmed))
  }

  return {
    subject: 'Your Colbert Capital sign-in code',
    html: layout({
      preheader: `Your sign-in code is ${code}. It expires in ${expiresInMinutes} minutes.`,
      eyebrow: 'Secure sign-in',
      title: `Here is your sign-in code, ${firstName}.`,
      intro:
        'We received a request to sign in to your Colbert Capital account. Enter the code below to continue.',
      body: codeBlock(code, 'Your sign-in code') + metaPanel(rows.join('')),
    }),
  }
}

export function renderResetPasswordEmail({ firstName = 'there', code, expiresInMinutes = 10 }) {
  return {
    subject: 'Reset your Colbert Capital password',
    html: layout({
      preheader: `Your password reset code is ${code}. It expires in ${expiresInMinutes} minutes.`,
      eyebrow: 'Password reset',
      title: `Reset your password, ${firstName}.`,
      intro:
        'Use the code below to choose a new password. If you did not request a reset, no changes have been made to your account.',
      body:
        codeBlock(code, 'Your reset code') +
        metaPanel(metaRow('Valid for', `${expiresInMinutes} minutes`) + metaRow('Use', 'One time only')),
    }),
  }
}

export function renderInquiryNotification({ inquiry }) {
  const rows = [
    metaRow('Name', inquiry.name),
    metaRow('Email', inquiry.email),
    metaRow('Company', inquiry.company),
    metaRow('Inquiry type', inquiry.inquiryType),
    metaRow('Region', inquiry.region),
  ].join('')

  return {
    subject: `New inquiry — ${inquiry.inquiryType} — ${inquiry.name}`,
    html: layout({
      preheader: `${inquiry.name} (${inquiry.company}) submitted a ${inquiry.inquiryType} inquiry.`,
      eyebrow: 'Website inquiry',
      title: `${inquiry.name} from ${inquiry.company}`,
      intro: 'A new inquiry was submitted through the Colbert Capital website.',
      body:
        metaPanel(rows) +
        `
    <tr>
      <td style="padding:22px 36px 8px;">
        <div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:2.2px;
                    text-transform:uppercase;color:${MUTED};padding-bottom:10px;">Message</div>
        <div style="background:${CREAM};border:1px solid ${HAIRLINE};border-radius:12px;padding:18px;
                    font-family:${SANS};font-size:14px;line-height:1.75;color:${INK};white-space:pre-wrap;">${inquiry.message}</div>
      </td>
    </tr>`,
    }),
  }
}

export function renderInquiryAutoReply({ name }) {
  return {
    subject: 'We have received your message — Colbert Capital',
    html: layout({
      preheader: 'Your inquiry has reached the Colbert Capital team.',
      eyebrow: 'Inquiry received',
      title: `Thank you, ${name}.`,
      intro:
        'Your message has reached the right team. A member of Colbert Capital will respond within one business day. If your matter is urgent, reply directly to this email.',
      body: metaPanel(
        metaRow('Response time', 'Within 1 business day') +
          metaRow('Reference', `CS-${Date.now().toString().slice(-6)}`),
      ),
    }),
  }
}

function messageBlock(label, body) {
  return `
    <tr>
      <td style="padding:22px 36px 8px;">
        <div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:2.2px;
                    text-transform:uppercase;color:${MUTED};padding-bottom:10px;">${label}</div>
        <div style="background:${CREAM};border:1px solid ${HAIRLINE};border-radius:12px;padding:18px;
                    font-family:${SANS};font-size:14px;line-height:1.75;color:${INK};white-space:pre-wrap;">${body}</div>
      </td>
    </tr>`
}

/** Sent to the operations inbox whenever a client opens a ticket or replies on one. */
export function renderSupportTicketNotification({ thread, latestBody, isReply = false }) {
  const rows = [
    metaRow('Reference', thread.reference),
    metaRow('Client', thread.clientName || thread.user?.firstName || '—'),
    metaRow('Email', thread.email),
    metaRow('Topic', thread.topic),
    metaRow('Priority', thread.priority),
    metaRow('Status', thread.status),
  ].join('')

  return {
    subject: isReply
      ? `Ticket reply — ${thread.reference} — ${thread.subject}`
      : `New ticket — ${thread.reference} — ${thread.subject}`,
    html: layout({
      preheader: `${isReply ? 'A client replied to' : 'A client opened'} ticket ${thread.reference}.`,
      eyebrow: 'Client support',
      title: thread.subject,
      intro: isReply
        ? 'A client added a message to an existing support ticket.'
        : 'A new support ticket was opened from the client dashboard.',
      body: metaPanel(rows) + messageBlock(isReply ? 'New message' : 'Message', latestBody),
    }),
  }
}

/** Sent to the client when the operations team replies on their ticket. */
export function renderSupportReplyEmail({ firstName = 'there', thread, body }) {
  return {
    subject: `Re: ${thread.subject} — Colbert Capital support`,
    html: layout({
      preheader: `The Colbert Capital team replied to ticket ${thread.reference}.`,
      eyebrow: 'Support update',
      title: `You have a reply, ${firstName}.`,
      intro:
        'A member of the Colbert Capital team has responded to your support ticket. Reply from your dashboard if you need anything else.',
      body:
        messageBlock('Reply', body) +
        metaPanel(
          metaRow('Ticket', thread.reference) + metaRow('Subject', thread.subject),
        ),
    }),
  }
}
