import { Router } from 'express'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { authenticate } from '../../middleware/authenticate.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js'
import * as schema from './transactions.schema.js'
import * as service from './transactions.service.js'

const router = Router()

/** Registers a route with the shared guard chain and response envelope. */
function route(method, path, { body, query, params, status = 200, paginated = false } = {}, handler) {
  const chain = [authenticate]
  if (body) chain.push(validateBody(body))
  if (query) chain.push(validateQuery(query))
  if (params) chain.push(validateParams(params))
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

route('get', '/', { query: schema.listTransactionsQuerySchema, paginated: true }, (req) =>
  service.listMyTransactions({ user: req.user, query: req.query }),
)

route('get', '/:id', { params: schema.transactionIdParamsSchema }, (req) =>
  service.getMyTransaction({ user: req.user, id: req.params.id }),
)

route('post', '/deposit', { body: schema.depositSchema, status: 201 }, (req) =>
  service.requestDeposit({ user: req.user, input: req.body }),
)

route('post', '/withdrawal', { body: schema.withdrawalSchema, status: 201 }, (req) =>
  service.requestWithdrawal({ user: req.user, input: req.body }),
)

export default router
