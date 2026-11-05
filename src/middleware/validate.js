import { ApiError } from '../lib/ApiError.js'

/**
 * Validates a request part against a zod schema and replaces it with the parsed,
 * coerced value. Strips unknown keys by default — callers never see raw input.
 */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source])

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      }))
      return next(ApiError.validation('Validation failed.', details))
    }

    req[source] = result.data
    return next()
  }

export const validateBody = (schema) => validate(schema, 'body')
export const validateQuery = (schema) => validate(schema, 'query')
export const validateParams = (schema) => validate(schema, 'params')
