import { prisma } from '../../config/prisma.js'
import {
  publicInvestment,
  publicMarketPosition,
  publicTransaction,
  publicUser,
  toNumber,
} from '../../lib/serialize.js'

export async function getDashboard({ user }) {
  const [
    profile,
    activeCount,
    activeInvestments,
    marketPositions,
    recentTransactions,
    pendingRequests,
    openTickets,
  ] = await prisma.$transaction([
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.investment.count({ where: { userId: user.id, status: 'ACTIVE' } }),
    prisma.investment.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { maturesAt: 'asc' },
      take: 5,
      include: { plan: true },
    }),
    prisma.marketPosition.findMany({
      where: { userId: user.id },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 12,
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.transaction.count({ where: { userId: user.id, status: 'PENDING' } }),
    prisma.supportThread.count({
      where: { userId: user.id, status: { not: 'RESOLVED' } },
    }),
  ])

  const current = profile ?? user

  return {
    user: publicUser(current),
    portfolio: {
      balance: toNumber(current.balance),
      totalInvested: toNumber(current.totalInvested),
      totalEarnings: toNumber(current.totalEarnings),
      activeInvestments: activeCount,
      openPositions: marketPositions.length,
      openTickets,
      pendingRequests,
    },
    activeInvestments: activeInvestments.map(publicInvestment),
    marketPositions: marketPositions.map(publicMarketPosition),
    recentTransactions: recentTransactions.map(publicTransaction),
  }
}

export async function updateProfile({ user, input }) {
  // Only the four profile fields are ever touched; anything else is ignored.
  const data = {}
  if (input.firstName !== undefined) data.firstName = input.firstName
  if (input.lastName !== undefined) data.lastName = input.lastName
  if (input.phone !== undefined) data.phone = input.phone || null
  if (input.country !== undefined) data.country = input.country || null

  const updated = await prisma.user.update({ where: { id: user.id }, data })

  return publicUser(updated)
}
