import { Router } from 'express'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { authenticate } from '../../middleware/authenticate.js'
import { authLimiter } from '../../middleware/rateLimiters.js'
import { validateBody } from '../../middleware/validate.js'
import * as schema from './auth.schema.js'
import * as service from './auth.service.js'

const router = Router()

/** Registers a route with the shared guard chain and response envelope. */
function route(method, path, { validator, guard, status = 200, throttle = true }, handler) {
  const chain = []
  // Credential and OTP endpoints share a tight bucket; session management
  // (refresh/logout/me) only carries the baseline API limiter.
  if (throttle) chain.push(authLimiter)
  if (validator) chain.push(validateBody(validator))
  if (guard) chain.push(guard)
  chain.push(
    asyncHandler(async (req, res) => {
      const data = await handler(req)
      res.status(status).json({ data })
    }),
  )
  router[method](path, ...chain)
}

// --- public credential flows ------------------------------------------------

route(
  'post',
  '/register',
  { validator: schema.registerSchema, status: 201 },
  (req) => service.register({ input: req.body, req }),
)

route('post', '/verify-email', { validator: schema.verifyEmailSchema }, (req) =>
  service.verifyEmail({ input: req.body, req }),
)

route('post', '/resend-otp', { validator: schema.resendOtpSchema }, (req) =>
  service.resendOtp({ input: req.body, req }),
)

route('post', '/login', { validator: schema.loginSchema }, (req) =>
  service.login({ input: req.body, req }),
)

route('post', '/login/verify', { validator: schema.loginVerifySchema }, (req) =>
  service.loginVerify({ input: req.body, req }),
)

route('post', '/admin/login', { validator: schema.loginSchema }, (req) =>
  service.adminLogin({ input: req.body, req }),
)

route('post', '/forgot-password', { validator: schema.forgotPasswordSchema }, (req) =>
  service.forgotPassword({ input: req.body, req }),
)

route('post', '/reset-password', { validator: schema.resetPasswordSchema }, (req) =>
  service.resetPassword({ input: req.body, req }),
)

// --- session management -----------------------------------------------------

route('post', '/refresh', { validator: schema.refreshSchema, throttle: false }, (req) =>
  service.refresh({ input: req.body, req }),
)

route('post', '/logout', { validator: schema.logoutSchema, throttle: false }, (req) =>
  service.logout({ input: req.body }),
)

route('get', '/me', { guard: authenticate, throttle: false }, (req) => service.me({ user: req.user }))

export default router
