import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { Resend } from 'resend'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { ApiError } from '../lib/ApiError.js'

let cachedClient = null

function getClient() {
  if (!env.RESEND_API_KEY) return null
  if (!cachedClient) cachedClient = new Resend(env.RESEND_API_KEY)
  return cachedClient
}

const OUTBOX_FILE = 'outbox.jsonl'

/** Pulls the first 6 digit code out of a rendered email so dev tooling can read it without an inbox. */
function extractCode(html) {
  const match = String(html ?? '').match(/\b(\d{6})\b/)
  return match ? match[1] : null
}

/**
 * Development transport: appends the rendered email to a local outbox file instead
 * of handing it to a provider. Nothing leaves the machine, and tests can read the
 * one-time code straight off disk.
 */
async function writeToOutbox({ to, subject, html, replyTo }) {
  const dir = path.resolve(process.cwd(), env.MAIL_SINK_DIR)
  await mkdir(dir, { recursive: true })

  const record = {
    sentAt: new Date().toISOString(),
    from: env.MAIL_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    replyTo: replyTo || env.MAIL_REPLY_TO || null,
    code: extractCode(html),
    html,
  }

  const file = path.join(dir, OUTBOX_FILE)
  await appendFile(file, `${JSON.stringify(record)}\n`, 'utf8')
  logger.info({ to: record.to, code: record.code, file }, 'email written to local outbox')
  return { local: true, file, code: record.code }
}

/**
 * Sends a transactional email through Resend, or writes it to the local outbox
 * when MAIL_TRANSPORT=file.
 * Throws an ApiError when the provider rejects the message so callers can
 * surface a meaningful failure (e.g. OTP could not be delivered).
 */
export async function sendMail({ to, subject, html, replyTo }) {
  if (!env.MAIL_ENABLED) {
    logger.info({ to, subject }, 'mail disabled — skipping send')
    return { skipped: true }
  }

  if (env.MAIL_TRANSPORT === 'file') {
    return writeToOutbox({ to, subject, html, replyTo })
  }

  const client = getClient()
  if (!client) {
    logger.warn({ to, subject }, 'RESEND_API_KEY not configured — skipping send')
    return { skipped: true }
  }

  const { data, error } = await client.emails.send({
    from: env.MAIL_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    replyTo: replyTo || env.MAIL_REPLY_TO || undefined,
  })

  if (error) {
    logger.error({ err: error, to, subject }, 'resend rejected the message')
    throw ApiError.internal('We could not send the email. Please try again.')
  }

  logger.info({ messageId: data?.id, to, subject }, 'email accepted by resend')
  return data
}

/**
 * Notification helper: a mail failure must never break the action that triggered it
 * (a reply is still saved even if the notification cannot be delivered).
 */
export async function sendMailSafe(message) {
  try {
    return await sendMail(message)
  } catch (error) {
    logger.warn({ err: error, to: message?.to, subject: message?.subject }, 'notification email failed')
    return { failed: true }
  }
}
