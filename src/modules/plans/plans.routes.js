import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { validateParams, validateQuery } from '../../middleware/validate.js'
import * as service from './plans.service.js'

const listQuerySchema = z.object({
  risk: z.enum(['LOW', 'MODERATE', 'HIGH']).optional(),
})

const slugParamSchema = z.object({
  slug: z.string().trim().min(1).max(80),
})

const router = Router()

/** Registers a route with its validator and the shared response envelope. */
function route(method, path, { validator } = {}, handler) {
  const chain = []
  if (validator) chain.push(validator)
  chain.push(
    asyncHandler(async (req, res) => {
      const data = await handler(req)
      res.json({ data })
    }),
  )
  router[method](path, ...chain)
}

// --- public catalogue -------------------------------------------------------

route('get', '/', { validator: validateQuery(listQuerySchema) }, (req) =>
  service.listPlans({ risk: req.query.risk }),
)

route('get', '/:slug', { validator: validateParams(slugParamSchema) }, (req) =>
  service.getPlanBySlug(req.params.slug),
)

export default router
