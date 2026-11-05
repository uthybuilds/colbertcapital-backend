import { prisma, runTransaction } from '../../config/prisma.js'
import { ApiError } from '../../lib/ApiError.js'
import { buildMeta, parsePagination } from '../../lib/pagination.js'
import { nextReference } from '../../lib/reference.js'
import { publicMarketPosition, toNumber } from '../../lib/serialize.js'

const toMoney = (value) => Number(value).toFixed(2)
const toShareQuantity = (value) => Number(value).toFixed(6)
const toPrice = (value) => Number(value).toFixed(4)

export async function listMyPositions({ user, query }) {
  const { page, limit, skip, take } = parsePagination(query)

  const where = { userId: user.id }

  const [total, records] = await prisma.$transaction([
    prisma.marketPosition.count({ where }),
    prisma.marketPosition.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
    }),
  ])

  return {
    items: records.map(publicMarketPosition),
    meta: buildMeta({ page, limit, total }),
  }
}

export async function buyPosition({ user, input }) {
  const quantity = Number(input.quantity)
  const price = Number(input.price)
  const gross = Number((quantity * price).toFixed(2))

  if (!Number.isFinite(gross) || gross <= 0) {
    throw ApiError.badRequest('The order amount must be greater than zero.')
  }

  const symbol = String(input.symbol || '').trim().toUpperCase()
  const name = String(input.name || '').trim()

  const position = await runTransaction(async (tx) => {
    const account = await tx.user.findUnique({ where: { id: user.id } })

    if (!account) {
      throw ApiError.notFound('Client not found.')
    }

    const availableBalance = toNumber(account.balance)
    if (availableBalance < gross) {
      throw ApiError.badRequest('Your available balance is not enough for this order.')
    }

    const existing = await tx.marketPosition.findUnique({
      where: { userId_symbol: { userId: user.id, symbol } },
    })

    const nextQuantity = quantity + (existing ? toNumber(existing.quantity) : 0)
    const nextCostBasis = gross + (existing ? toNumber(existing.costBasis) : 0)
    const averagePrice = nextCostBasis / nextQuantity

    const saved = existing
      ? await tx.marketPosition.update({
          where: { userId_symbol: { userId: user.id, symbol } },
          data: {
            name,
            exchange: input.exchange || existing.exchange,
            assetType: input.assetType || existing.assetType,
            quantity: toShareQuantity(nextQuantity),
            costBasis: toMoney(nextCostBasis),
            averagePrice: toPrice(averagePrice),
          },
        })
      : await tx.marketPosition.create({
          data: {
            userId: user.id,
            symbol,
            name,
            exchange: input.exchange || null,
            assetType: input.assetType || null,
            quantity: toShareQuantity(quantity),
            costBasis: toMoney(gross),
            averagePrice: toPrice(price),
          },
        })

    const reference = await nextReference(tx, 'transaction', 'TXN')

    await tx.transaction.create({
      data: {
        reference,
        userId: user.id,
        type: 'INVESTMENT',
        status: 'COMPLETED',
        amount: toMoney(gross),
        fee: '0.00',
        netAmount: toMoney(gross),
        currency: 'USD',
        methodLabel: symbol,
        note: `Bought ${quantity.toFixed(4)} shares of ${name} at ${price.toFixed(2)}.`,
      },
    })

    await tx.user.update({
      where: { id: user.id },
      data: {
        balance: { decrement: toMoney(gross) },
        totalInvested: { increment: toMoney(gross) },
      },
    })

    return saved
  })

  return publicMarketPosition(position)
}
