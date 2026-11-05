import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { publicUser } from '../../lib/serialize.js'
import { authenticate } from '../../middleware/authenticate.js'
import { validateBody } from '../../middleware/validate.js'
import * as service from './account.service.js'

const router = Router()

const updateProfileSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, 'First name must be at least 2 characters.')
      .max(60, 'First name is too long.')
      .optional(),
    lastName: z
      .string()
      .trim()
      .min(2, 'Last name must be at least 2 characters.')
      .max(60, 'Last name is too long.')
      .optional(),
    phone: z.string().trim().max(32, 'Phone number is too long.').optional(),
    country: z.string().trim().max(64, 'Country is too long.').optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  })

/** Registers a route with the auth guard chain and response envelope. */
function route(method, path, { validator, status = 200 }, handler) {
  const chain = [authenticate]
  if (validator) chain.push(validateBody(validator))
  chain.push(
    asyncHandler(async (req, res) => {
      const data = await handler(req)
      res.status(status).json({ data })
    }),
  )
  router[method](path, ...chain)
}

route('get', '/dashboard', {}, (req) => service.getDashboard({ user: req.user }))

route('get', '/profile', {}, (req) => publicUser(req.user))

route('patch', '/profile', { validator: updateProfileSchema }, (req) =>
  service.updateProfile({ user: req.user, input: req.body }),
)

export default router
