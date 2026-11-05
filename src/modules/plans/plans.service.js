import { prisma } from '../../config/prisma.js'
import { ApiError } from '../../lib/ApiError.js'
import { publicPlan } from '../../lib/serialize.js'

/** Lists every active plan, optionally narrowed to a single risk level. */
export async function listPlans({ risk } = {}) {
  const plans = await prisma.plan.findMany({
    where: { status: 'ACTIVE', ...(risk ? { riskLevel: risk } : {}) },
    orderBy: { sortOrder: 'asc' },
  })

  return plans.map(publicPlan)
}

/** Loads a single active plan by its public slug. */
export async function getPlanBySlug(slug) {
  const plan = await prisma.plan.findUnique({ where: { slug } })

  if (!plan || plan.status !== 'ACTIVE') {
    throw ApiError.notFound('That plan is not available.')
  }

  return publicPlan(plan)
}
