import { Router } from 'express'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { authenticate } from '../../middleware/authenticate.js'
import * as service from './funding.service.js'

const router = Router()

/** Registers a route behind the auth guard with the shared response envelope. */
function route(method, path, { guard } = {}, handler) {
  const chain = []
  if (guard) chain.push(guard)
  chain.push(
    asyncHandler(async (req, res) => {
      const data = await handler(req)
      res.json({ data })
    }),
  )
  router[method](path, ...chain)
}

// --- deposit instructions ---------------------------------------------------

route('get', '/', { guard: authenticate }, () => service.listFundingMethods())

export default router
