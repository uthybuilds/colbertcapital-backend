import crypto from 'node:crypto'
import compression from 'compression'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { ApiError } from './lib/ApiError.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { apiLimiter } from './middleware/rateLimiters.js'
import apiRoutes from './routes/index.js'

export function createApp() {
  const app = express()

  // Render/Vercel terminate TLS in front of the app; trust their forwarding
  // headers so rate limiting sees the real client hop. The number of trusted
  // hops is configuration, never a client-supplied value: trusting too many
  // lets a caller forge the address we rate-limit and audit against.
  app.set('trust proxy', env.TRUST_PROXY)
  app.disable('x-powered-by')

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          imgSrc: ["'self'", 'data:', 'https://*.trae.ai', 'https://*.coingecko.com', 'https://icon.horse'],
          connectSrc: ["'self'", 'https://*.coingecko.com', 'https://api.finnhub.io'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
    }),
  )

  // Device APIs the platform never asks for. Geolocation in particular is a
  // direct route to where a visitor is, and interest-cohort opts every page out
  // of ad-topic inference.
  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    )
    next()
  })

  app.use(compression())
  app.use(express.json({ limit: '256kb' }))
  app.use(express.urlencoded({ extended: false, limit: '256kb' }))

  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header = curl, server-to-server, or same-origin.
        if (!origin || env.corsOrigins.length === 0 || env.corsOrigins.includes(origin)) {
          return callback(null, true)
        }
        return callback(ApiError.forbidden('This origin is not allowed to call the API.'))
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    }),
  )

  app.use(
    pinoHttp({
      logger,
      genReqId(req, res) {
        // A supplied id is echoed only when it is a plain identifier, so a
        // caller can neither inject into our headers nor collide their trace
        // id with somebody else's request.
        const supplied = String(req.headers['x-request-id'] || '')
        const id = /^[A-Za-z0-9._-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID()
        res.setHeader('x-request-id', id)
        return id
      },
      // Log the shape of the request only. The caller's address and every
      // header (cookies, bearer tokens, forwarding chains) stay out of the log
      // stream entirely, which the default serializers do not guarantee.
      serializers: {
        req(req) {
          return { id: req.id, method: req.method, url: req.url, query: req.query }
        },
        res(res) {
          return { statusCode: res.statusCode }
        },
      },
      autoLogging: {
        ignore: (req) => req.url?.startsWith(`${env.API_PREFIX}/health`),
      },
    }),
  )

  app.get('/', (_req, res) => {
    // Deliberately thin: no environment, prefix or build detail, so a scanner
    // learns nothing about how this service is deployed.
    res.json({ data: { name: 'Colbert Capital API' } })
  })

  app.use(env.API_PREFIX, apiLimiter, apiRoutes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
