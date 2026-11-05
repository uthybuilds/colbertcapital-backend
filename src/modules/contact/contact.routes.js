import { Router } from 'express'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { contactLimiter } from '../../middleware/rateLimiters.js'
import { validateBody } from '../../middleware/validate.js'
import * as schema from './contact.schema.js'
import * as service from './contact.service.js'

const router = Router()

/** Registers a route with the shared guard chain and response envelope. */
function route(method, path, { validator, limiters = [], status = 200 }, handler) {
  const chain = [...limiters]
  if (validator) chain.push(validateBody(validator))
  chain.push(
    asyncHandler(async (req, res) => {
      const data = await handler(req)
      res.status(status).json({ data })
    }),
  )
  router[method](path, ...chain)
}

// --- public ---------------------------------------------------------------

route(
  'post',
  '/',
  { validator: schema.contactSchema, status: 201, limiters: [contactLimiter] },
  (req) => service.submitInquiry({ input: req.body, req }),
)

export default router
