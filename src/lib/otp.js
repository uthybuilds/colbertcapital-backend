import crypto from 'node:crypto'
import { env } from '../config/env.js'

/** Six digit numeric code, zero padded (e.g. "004821"). */
export function generateOtp() {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  return { code, codeHash: hashOtp(code) }
}

export function hashOtp(code) {
  return crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update(String(code)).digest('hex')
}

export function otpExpiry() {
  return new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000)
}

/** Constant-time comparison so code verification leaks no timing signal. */
export function matchesOtp(code, codeHash) {
  const candidate = Buffer.from(hashOtp(code), 'hex')
  const expected = Buffer.from(String(codeHash), 'hex')
  if (candidate.length !== expected.length) return false
  return crypto.timingSafeEqual(candidate, expected)
}
