import { Router } from 'express'
import { asyncHandler } from '../../lib/asyncHandler.js'
import { authenticate } from '../../middleware/authenticate.js'
import { requireAdmin } from '../../middleware/authorize.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js'
import * as schema from './admin.schema.js'
import * as service from './admin.service.js'

const router = Router()

/**
 * Registers a route behind the admin guard chain. Handlers returning a
 * `{ items, meta }` payload (paginated lists) answer with the shared
 * `{ data, meta }` envelope; everything else is wrapped in `{ data }`.
 */
function route(method, path, { body, query, params, status = 200 } = {}, handler) {
  const chain = [authenticate, requireAdmin]
  if (params) chain.push(validateParams(params))
  if (query) chain.push(validateQuery(query))
  if (body) chain.push(validateBody(body))
  chain.push(
    asyncHandler(async (req, res) => {
      const result = await handler(req)

      if (result && typeof result === 'object' && 'meta' in result) {
        return res.status(status).json({ data: result.items, meta: result.meta })
      }
      return res.status(status).json({ data: result })
    }),
  )
  router[method](path, ...chain)
}

// --- overview ---------------------------------------------------------------

route('get', '/metrics', {}, () => service.getMetrics())
route('get', '/bootstrap', {}, () => service.getBootstrap())

// --- users ------------------------------------------------------------------

route('get', '/users', { query: schema.listQuerySchema }, (req) =>
  service.listUsers({ query: req.query }),
)

route('post', '/users', { body: schema.createUserSchema, status: 201 }, (req) =>
  service.createUser({ input: req.body, actor: req.user, req }),
)

route('get', '/users/:id', { params: schema.idParamSchema }, (req) =>
  service.getUser({ id: req.params.id }),
)

route(
  'patch',
  '/users/:id',
  { params: schema.idParamSchema, body: schema.updateUserSchema },
  (req) => service.updateUser({ id: req.params.id, input: req.body, actor: req.user, req }),
)

route('delete', '/users/:id', { params: schema.idParamSchema }, (req) =>
  service.deleteUser({ id: req.params.id, actor: req.user, req }),
)

route(
  'post',
  '/users/:id/suspend',
  { params: schema.idParamSchema, body: schema.suspendSchema },
  (req) => service.suspendUser({ id: req.params.id, input: req.body, actor: req.user, req }),
)

route('post', '/users/:id/activate', { params: schema.idParamSchema }, (req) =>
  service.activateUser({ id: req.params.id, actor: req.user, req }),
)

route(
  'post',
  '/users/:id/balance',
  { params: schema.idParamSchema, body: schema.balanceSchema },
  (req) => service.adjustBalance({ id: req.params.id, input: req.body, actor: req.user, req }),
)

// --- transactions -----------------------------------------------------------

route('get', '/transactions', { query: schema.listQuerySchema }, (req) =>
  service.listTransactions({ query: req.query }),
)

route('post', '/transactions', { body: schema.createTransactionSchema, status: 201 }, (req) =>
  service.createTransaction({ input: req.body, actor: req.user, req }),
)

route(
  'patch',
  '/transactions/:id',
  { params: schema.idParamSchema, body: schema.updateTransactionSchema },
  (req) => service.updateTransaction({ id: req.params.id, input: req.body, actor: req.user, req }),
)

route('delete', '/transactions/:id', { params: schema.idParamSchema }, (req) =>
  service.deleteTransaction({ id: req.params.id, actor: req.user, req }),
)

route('post', '/transactions/:id/approve', { params: schema.idParamSchema }, (req) =>
  service.approveTransaction({ id: req.params.id, actor: req.user, req }),
)

route(
  'post',
  '/transactions/:id/reject',
  { params: schema.idParamSchema, body: schema.rejectSchema },
  (req) => service.rejectTransaction({ id: req.params.id, input: req.body, actor: req.user, req }),
)

// --- investments ------------------------------------------------------------

route('get', '/investments', { query: schema.listQuerySchema }, (req) =>
  service.listInvestments({ query: req.query }),
)

route('post', '/investments', { body: schema.createInvestmentSchema, status: 201 }, (req) =>
  service.createInvestment({ input: req.body, actor: req.user, req }),
)

route(
  'patch',
  '/investments/:id',
  { params: schema.idParamSchema, body: schema.updateInvestmentSchema },
  (req) => service.updateInvestment({ id: req.params.id, input: req.body, actor: req.user, req }),
)

route('post', '/investments/:id/close', { params: schema.idParamSchema }, (req) =>
  service.closeInvestment({ id: req.params.id, actor: req.user, req }),
)

// --- plans ------------------------------------------------------------------

route('get', '/plans', {}, () => service.listPlans())

route('post', '/plans', { body: schema.createPlanSchema, status: 201 }, (req) =>
  service.createPlan({ input: req.body, actor: req.user, req }),
)

route('patch', '/plans/:id', { params: schema.idParamSchema, body: schema.updatePlanSchema }, (req) =>
  service.updatePlan({ id: req.params.id, input: req.body, actor: req.user, req }),
)

route('delete', '/plans/:id', { params: schema.idParamSchema }, (req) =>
  service.deletePlan({ id: req.params.id, actor: req.user, req }),
)

// --- support ----------------------------------------------------------------

route('get', '/support', { query: schema.listQuerySchema }, (req) =>
  service.listThreads({ query: req.query }),
)

route(
  'post',
  '/support/:id/reply',
  { params: schema.idParamSchema, body: schema.replySchema },
  (req) => service.replyToThread({ id: req.params.id, input: req.body, actor: req.user, req }),
)

route(
  'patch',
  '/support/:id',
  { params: schema.idParamSchema, body: schema.threadStatusSchema },
  (req) => service.updateThread({ id: req.params.id, input: req.body, actor: req.user, req }),
)

route('delete', '/support/:id', { params: schema.idParamSchema }, (req) =>
  service.deleteThread({ id: req.params.id, actor: req.user, req }),
)

// --- funding methods --------------------------------------------------------

route('get', '/funding-methods', {}, () => service.listPaymentMethods())

route('post', '/funding-methods', { body: schema.paymentMethodSchema, status: 201 }, (req) =>
  service.createPaymentMethod({ input: req.body, actor: req.user, req }),
)

route(
  'patch',
  '/funding-methods/:id',
  { params: schema.idParamSchema, body: schema.updatePaymentMethodSchema },
  (req) => service.updatePaymentMethod({ id: req.params.id, input: req.body, actor: req.user, req }),
)

route('delete', '/funding-methods/:id', { params: schema.idParamSchema }, (req) =>
  service.deletePaymentMethod({ id: req.params.id, actor: req.user, req }),
)

// --- audit logs -------------------------------------------------------------

route('get', '/audit-logs', { query: schema.listQuerySchema }, (req) =>
  service.listAuditLogs({ query: req.query }),
)

export default router
