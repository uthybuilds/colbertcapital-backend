import { Router } from 'express'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { authenticate } from '../../middleware/authenticate.js'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import * as schema from './positions.schema.js'
import * as service from './positions.service.js'

const router = Router()

function route(method, path, { body, query, status = 200, paginated = false } = {}, handler) {
  const chain = [authenticate]
  if (body) chain.push(validateBody(body))
  if (query) chain.push(validateQuery(query))
  chain.push(
    asyncHandler(async (req, res) => {
      const result = await handler(req)

      if (paginated) {
        return res.status(status).json({ data: result.items, meta: result.meta })
      }

      return res.status(status).json({ data: result })
    }),
  )

  router[method](path, ...chain)
}

route('get', '/', { query: schema.listPositionsQuerySchema, paginated: true }, (req) =>
  service.listMyPositions({ user: req.user, query: req.query }),
)

route('post', '/buy', { body: schema.buyPositionSchema, status: 201 }, (req) =>
  service.buyPosition({ user: req.user, input: req.body }),
)

export default router
