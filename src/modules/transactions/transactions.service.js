import { prisma, runTransaction } from '../../config/prisma.js'
import { ApiError } from '../../lib/ApiError.js'
import { buildMeta, parsePagination } from '../../lib/pagination.js'
import { nextReference } from '../../lib/reference.js'
import { publicTransaction, toNumber } from '../../lib/serialize.js'

export async function listMyTransactions({ user, query }) {
  const { page, limit, skip, take } = parsePagination(query)

  const where = { userId: user.id }
  if (query.type) where.type = query.type
  if (query.status) where.status = query.status

  const [records, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.transaction.count({ where }),
  ])

  return {
    items: records.map(publicTransaction),
    meta: buildMeta({ page, limit, total }),
  }
}

export async function getMyTransaction({ user, id }) {
  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
  })

  if (!transaction) throw ApiError.notFound('That transaction could not be found.')

  return publicTransaction(transaction)
}

export async function requestDeposit({ user, input }) {
  // A deposit request is only a request: it is created PENDING and never
  // touches the balance until an administrator approves it.
  const transaction = await runTransaction(async (tx) => {
    const reference = await nextReference(tx, 'transaction', 'TXN')

    return tx.transaction.create({
      data: {
        reference,
        userId: user.id,
        type: 'DEPOSIT',
        status: 'PENDING',
        amount: input.amount.toFixed(2),
        fee: '0.00',
        netAmount: input.amount.toFixed(2),
        currency: input.currency,
        methodLabel: input.methodLabel,
        walletAddress: input.walletAddress || null,
        note: input.note || null,
      },
    })
  })

  return publicTransaction(transaction)
}

export async function requestWithdrawal({ user, input }) {
  const transaction = await runTransaction(async (tx) => {
    const account = await tx.user.findUnique({ where: { id: user.id } })

    if (toNumber(account.balance) < input.amount) {
      throw ApiError.badRequest('Your available balance is not enough for this withdrawal.')
    }

    // The request is recorded PENDING only — the balance is debited later,
    // when an administrator approves it.
    const reference = await nextReference(tx, 'transaction', 'TXN')

    return tx.transaction.create({
      data: {
        reference,
        userId: user.id,
        type: 'WITHDRAWAL',
        status: 'PENDING',
        amount: input.amount.toFixed(2),
        fee: '0.00',
        netAmount: input.amount.toFixed(2),
        currency: input.currency,
        methodLabel: input.methodLabel,
        destinationName: input.destinationName,
        destinationDetails: input.destinationDetails,
        note: input.note || null,
      },
    })
  })

  return publicTransaction(transaction)
}
