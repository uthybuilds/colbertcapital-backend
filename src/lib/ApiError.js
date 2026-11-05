/**
 * Domain error with an HTTP status and a stable machine-readable code.
 * Anything thrown that is not an ApiError is treated as a 500.
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  static badRequest(message = 'Invalid request.', details) {
    return new ApiError(400, 'BAD_REQUEST', message, details)
  }

  static unauthorized(message = 'Authentication required.') {
    return new ApiError(401, 'UNAUTHORIZED', message)
  }

  static forbidden(message = 'You do not have access to this resource.') {
    return new ApiError(403, 'FORBIDDEN', message)
  }

  static notFound(message = 'Resource not found.') {
    return new ApiError(404, 'NOT_FOUND', message)
  }

  static conflict(message = 'Resource already exists.', details) {
    return new ApiError(409, 'CONFLICT', message, details)
  }

  static gone(message = 'Resource is no longer available.') {
    return new ApiError(410, 'GONE', message)
  }

  static validation(message = 'Validation failed.', details) {
    return new ApiError(422, 'VALIDATION_ERROR', message, details)
  }

  static tooManyRequests(message = 'Too many requests. Please slow down.') {
    return new ApiError(429, 'TOO_MANY_REQUESTS', message)
  }

  static internal(message = 'Something went wrong.') {
    return new ApiError(500, 'INTERNAL_ERROR', message)
  }
}
