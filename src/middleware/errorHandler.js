import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { ApiError } from '../lib/ApiError.js'

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist.`))
}

/** Maps known Prisma failures onto meaningful HTTP responses. */
function fromPrisma(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : 'field'
      return ApiError.conflict(`A record with that ${target} already exists.`)
    }
    if (error.code === 'P2025') {
      return ApiError.notFound('The requested record could not be found.')
    }
    if (error.code === 'P2003') {
      return ApiError.conflict('Operation blocked by a related record.')
    }
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return ApiError.badRequest('Malformed data supplied to the database layer.')
  }
  return null
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  let apiError

  if (error instanceof ApiError) {
    apiError = error
  } else if (error instanceof ZodError) {
    apiError = ApiError.validation(
      'Validation failed.',
      error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    )
  } else if (error?.type === 'entity.parse.failed') {
    apiError = ApiError.badRequest('Request body is not valid JSON.')
  } else {
    apiError = fromPrisma(error)
  }

  if (!apiError) {
    logger.error({ err: error, requestId: req.id, path: req.originalUrl }, 'unhandled error')
    apiError = ApiError.internal(
      env.isProduction ? 'Something went wrong.' : String(error?.message || error),
    )
  } else if (apiError.status >= 500) {
    logger.error({ err: error, requestId: req.id, path: req.originalUrl }, 'server error')
  }

  const payload = {
    error: {
      code: apiError.code,
      message: apiError.message,
    },
  }
  if (apiError.details) payload.error.details = apiError.details
  if (req.id) payload.error.requestId = req.id

  res.status(apiError.status).json(payload)
}
