import { ApiError } from '../lib/ApiError.js'

/** Route guard — must run after `authenticate`. */
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized())
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Administrator access is required for this resource.'))
    }
    return next()
  }

export const requireAdmin = requireRole('ADMIN')
