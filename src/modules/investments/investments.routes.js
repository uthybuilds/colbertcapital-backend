import { Router } from 'express'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { authenticate } from '../../middleware/authenticate.js'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import * as schema from './investments.schema.js'
import * as service from './investments.service.js'

const router = Router()

/** Registers a route with the auth guard chain and response envelope. */
function route(method, path, { validator, source = 'body', status = 200 }, handler) {
  const chain = [authenticate]
  if (validator) {
    chain.push(source === 'query' ? validateQuery(validator) : validateBody(validator))
  }
  chain.push(
    asyncHandler(async (req, res) => {
      const data = await handler(req)
      res.status(status).json(data)
    }),
  )
  router[method](path, ...chain)
}

route('get', '/', { validator: schema.listInvestmentsQuerySchema, source: 'query' }, async (req) => {
  const { items, meta } = await service.listMyInvestments({ user: req.user, query: req.query })
  return { data: items, meta }
})

route('post', '/', { validator: schema.createInvestmentSchema, status: 201 }, async (req) => {
  const investment = await service.createInvestment({ user: req.user, input: req.body })
  return { data: investment }
})

export default router
