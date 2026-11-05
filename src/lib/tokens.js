import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

const ISSUER = 'colbert-capital'
const AUDIENCE = 'colbert-capital-client'

/** Short-lived bearer token carrying the identity and role. */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL, issuer: ISSUER, audience: AUDIENCE },
  )
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER, audience: AUDIENCE })
}

/**
 * Refresh tokens are opaque random strings. Only their SHA-256 digest is
 * persisted, so a database leak cannot be replayed.
 */
export function issueRefreshToken() {
  const token = crypto.randomBytes(48).toString('base64url')
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  return { token, tokenHash: hashToken(token), expiresAt }
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}
