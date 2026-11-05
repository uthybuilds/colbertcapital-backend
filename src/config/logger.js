import pino from 'pino'
import { env } from './env.js'

export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  base: { service: 'colbert-capital-api', env: env.NODE_ENV },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      // A caller's address must never reach the log stream, in any shape: the
      // socket metadata, the forwarding chain, or a field on a payload.
      'req.remoteAddress',
      'req.remotePort',
      'req.headers["x-forwarded-for"]',
      'req.headers["x-real-ip"]',
      'req.headers["cf-connecting-ip"]',
      'res.headers["set-cookie"]',
      'ipAddress',
      '*.ipAddress',
      'password',
      '*.password',
      '*.passwordHash',
      '*.code',
      '*.codeHash',
      '*.token',
      '*.tokenHash',
    ],
    remove: true,
  },
})
