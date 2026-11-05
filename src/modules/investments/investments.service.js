import { prisma, runTransaction } from '../../config/prisma.js'
import { ApiError } from '../../lib/ApiError.js'
import { buildMeta, parsePagination } from '../../lib/pagination.js'
import { nextReference } from '../../lib/reference.js'
import { publicInvestment, toNumber } from '../../lib/serialize.js'

export async function listMyInvestments({ user, query }) {
  const { page, limit, skip, take } = parsePagination(query)

  const where = { userId: user.id }
  if (query.status) where.status = query.status

  const [total, investments] = await prisma.$transaction([
    prisma.investment.count({ where }),
    prisma.investment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { plan: true },
    }),
  ])

  return {
    items: investments.map(publicInvestment),
    meta: buildMeta({ page, limit, total }),
  }
}

export async function createInvestment({ user, input }) {
  const plan = await prisma.plan.findFirst({
    where: { slug: input.planSlug, status: 'ACTIVE' },
  })
  if (!plan) throw ApiError.notFound('That plan is not available.')

  return openInvestment({ userId: user.id, plan, amount: input.amount })
}

/**
 * Books an investment for a client: validates the plan limits, writes the
 * investment and its matching transaction, then moves the money out of the
 * available balance. Shared by the client checkout and the admin desk.
 */
export async function openInvestment({
  userId,
  plan,
  amount,
  expectedReturn,
  maturesAt,
  note = `Investment opened in the ${plan.name} plan.`,
}) {
  const value = toNumber(amount)
  const minAmount = toNumber(plan.minAmount)
  const maxAmount = toNumber(plan.maxAmount)

  if (value < minAmount) {
    throw ApiError.badRequest(
      `The minimum investment for ${plan.name} is ${minAmount.toFixed(2)}.`,
    )
  }
  if (value > maxAmount) {
    throw ApiError.badRequest(
      `The maximum investment for ${plan.name} is ${maxAmount.toFixed(2)}.`,
    )
  }

  const roiPercent = toNumber(plan.roiPercent)
  const payout =
    expectedReturn !== undefined && expectedReturn !== null
      ? Number(expectedReturn).toFixed(2)
      : (value + (value * roiPercent) / 100).toFixed(2)
  const maturity =
    maturesAt ?? new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000)

  const investment = await runTransaction(async (tx) => {
    // Re-read inside the transaction so concurrent requests cannot double-spend.
    const account = await tx.user.findUnique({ where: { id: userId } })
    if (!account || toNumber(account.balance) < value) {
      throw ApiError.badRequest('The client available balance is not enough to fund this investment.')
    }

    const reference = await nextReference(tx, 'investment', 'INV')
    const transactionReference = await nextReference(tx, 'transaction', 'TXN')

    const created = await tx.investment.create({
      data: {
        reference,
        userId,
        planId: plan.id,
        amount: value.toFixed(2),
        roiPercent: roiPercent.toFixed(2),
        expectedReturn: payout,
        status: 'ACTIVE',
        maturesAt: maturity,
      },
      include: { plan: true },
    })

    await tx.transaction.create({
      data: {
        reference: transactionReference,
        userId,
        type: 'INVESTMENT',
        status: 'COMPLETED',
        amount: value.toFixed(2),
        fee: '0.00',
        netAmount: value.toFixed(2),
        methodLabel: plan.name,
        note,
      },
    })

    await tx.user.update({
      where: { id: userId },
      data: {
        balance: { decrement: value.toFixed(2) },
        totalInvested: { increment: value.toFixed(2) },
      },
    })

    return created
  })

  return publicInvestment(investment)
}
