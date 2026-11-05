import { prisma } from '../config/prisma.js'
import { ApiError } from '../lib/ApiError.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { verifyAccessToken } from '../lib/tokens.js'

/**
 * Verifies the bearer token, loads the account, and rejects suspended users.
 * Attaches the full user record to req.user.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')

  if (!/^Bearer$/i.test(scheme) || !token) {
    throw ApiError.unauthorized('Missing bearer token.')
  }

  let payload
  try {
    payload = verifyAccessToken(token)
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.')
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } })

  if (!user) {
    throw ApiError.unauthorized('This account no longer exists.')
  }

  if (user.status === 'SUSPENDED') {
    throw ApiError.forbidden(
      'Your account is suspended. Please contact client services for assistance.',
    )
  }

  req.user = user
  req.auth = { payload }
  next()
})
