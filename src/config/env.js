import 'dotenv/config'
import { z } from 'zod'

/**
 * Reads and validates every environment variable the API depends on.
 * The process refuses to boot with an invalid configuration.
 */

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === 'boolean'
      ? value
      : ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase()),
  )

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().startsWith('/').default('/api/v1'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  CORS_ORIGINS: z.string().default(''),

  /**
   * How many proxies sit in front of the app. This decides where `req.ip` comes
   * from, so it is read from configuration and never from the request itself.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(45),
  OTP_DEV_EXPOSE: booleanish.default(false),

  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),

  RESEND_API_KEY: z.string().default(''),
  MAIL_FROM: z.string().default(''),
  MAIL_REPLY_TO: z.string().default(''),
  MAIL_INQUIRIES_TO: z.string().default(''),
  MAIL_ENABLED: booleanish.default(true),
  /** Where transactional mail goes: Resend in production, a local outbox file otherwise. */
  MAIL_TRANSPORT: z.enum(['resend', 'file']).default('resend'),
  MAIL_SINK_DIR: z.string().default('./tmp/mail'),

  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid environment configuration:\n${details}`)
}

const raw = parsed.data

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isDevelopment: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  /** Never expose OTPs in a production response, even if the flag is on. */
  otpDevExpose: raw.OTP_DEV_EXPOSE && raw.NODE_ENV !== 'production',
}
