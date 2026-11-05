import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'

const windowMs = env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000

const reject = (message) => (_req, res) => {
  res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message } })
}

/** Baseline limiter applied to the whole API surface. */
export const apiLimiter = rateLimit({
  windowMs,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: reject('Too many requests. Please slow down.'),
})

/** Stricter bucket for credential and OTP endpoints. */
export const authLimiter = rateLimit({
  windowMs,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: reject('Too many attempts. Please try again later.'),
})

/** Public contact form — tight hourly cap keyed by IP. */
export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: reject('You have sent several messages already. Please try again later.'),
})
