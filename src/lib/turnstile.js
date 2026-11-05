import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { ApiError } from './ApiError.js'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Verifies a Cloudflare Turnstile token server-side.
 * When TURNSTILE_ENABLED is false (local development) this is a no-op.
 */
export async function assertHuman(token, remoteIp) {
  if (!env.TURNSTILE_ENABLED) return

  if (!token) {
    throw ApiError.badRequest('Please complete the verification challenge.')
  }

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: String(token),
  })
  if (remoteIp) body.set('remoteip', remoteIp)

  try {
    const response = await fetch(VERIFY_URL, { method: 'POST', body })
    const result = await response.json()
    if (!result.success) {
      logger.warn({ codes: result['error-codes'] }, 'turnstile rejected a submission')
      throw ApiError.badRequest('Verification failed. Please try again.')
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    logger.error({ err: error }, 'turnstile verification errored')
    throw ApiError.internal('Could not verify the request.')
  }
}
