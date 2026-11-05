import { Router } from 'express'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { authenticate } from '../../middleware/authenticate.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import * as schema from './support.schema.js'
import * as service from './support.service.js'

const router = Router()

/** Registers a route with the shared guard chain and response envelope. */
function route(method, path, { body, params, status = 200 } = {}, handler) {
  const chain = [authenticate]
  if (params) chain.push(validateParams(params))
  if (body) chain.push(validateBody(body))
  chain.push(
    asyncHandler(async (req, res) => {
      const data = await handler(req)
      res.status(status).json({ data })
    }),
  )
  router[method](path, ...chain)
}

route('get', '/', {}, (req) => service.listMyThreads({ user: req.user }))

route('get', '/:id', { params: schema.threadIdParamsSchema }, (req) =>
  service.getMyThread({ user: req.user, id: req.params.id }),
)

route('post', '/', { body: schema.createThreadSchema, status: 201 }, (req) =>
  service.createThread({ user: req.user, input: req.body }),
)

route('post', '/:id/messages', { params: schema.threadIdParamsSchema, body: schema.replySchema, status: 201 }, (req) =>
  service.replyToThread({ user: req.user, id: req.params.id, input: req.body }),
)

export default router
