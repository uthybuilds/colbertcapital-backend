import { prisma, runTransaction } from '../../config/prisma.js'
import { ApiError } from '../../lib/ApiError.js'
import { recordAudit } from '../../lib/audit.js'
import { buildMeta, parsePagination } from '../../lib/pagination.js'
import { hashPassword } from '../../lib/password.js'
import { nextReference } from '../../lib/reference.js'
import { requestMeta } from '../../lib/request.js'
import { sendMailSafe } from '../../mail/mailer.js'
import { renderSupportReplyEmail } from '../../mail/templates.js'
import { openInvestment } from '../investments/investments.service.js'
import {
  publicInvestment,
  publicPaymentMethod,
  publicPlan,
  publicThread,
  publicTransaction,
  publicUser,
  toNumber,
} from '../../lib/serialize.js'

// ---------------------------------------------------------------- helpers

const toMoney = (value) => Number(value).toFixed(2)

/** Empty strings are persisted as null so clearing an optional field works. */
const orNull = (value) => {
  if (value === undefined) return undefined
  return value === '' ? null : value
}

// ---------------------------------------------------------------- metrics

export async function getMetrics() {
  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    pendingKyc,
    pendingTransactions,
    activeInvestments,
    openTickets,
    resolvedTickets,
    totalInquiries,
    invested,
    deposits,
    withdrawals,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count({ where: { kycStatus: 'PENDING' } }),
    prisma.transaction.count({ where: { status: 'PENDING' } }),
    prisma.investment.count({ where: { status: 'ACTIVE' } }),
    prisma.supportThread.count({ where: { status: 'OPEN' } }),
    prisma.supportThread.count({ where: { status: 'RESOLVED' } }),
    prisma.inquiry.count(),
    prisma.investment.aggregate({ _sum: { amount: true } }),
    prisma.transaction.aggregate({
      _sum: { netAmount: true },
      where: { type: 'DEPOSIT', status: 'COMPLETED' },
    }),
    prisma.transaction.aggregate({
      _sum: { netAmount: true },
      where: { type: 'WITHDRAWAL', status: 'COMPLETED' },
    }),
  ])

  return {
    totalUsers,
    activeUsers,
    suspendedUsers,
    pendingKyc,
    totalInvested: toNumber(invested._sum.amount) ?? 0,
    totalDeposits: toNumber(deposits._sum.netAmount) ?? 0,
    totalWithdrawals: toNumber(withdrawals._sum.netAmount) ?? 0,
    pendingTransactions,
    activeInvestments,
    openTickets,
    resolvedTickets,
    totalInquiries,
  }
}

export async function getBootstrap() {
  const [users, plans, investments, transactions, threads, paymentMethods] = await prisma.$transaction([
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.plan.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.investment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { plan: true },
    }),
    prisma.transaction.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.supportThread.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    }),
    prisma.paymentMethod.findMany({ orderBy: { createdAt: 'desc' } }),
  ])

  return {
    users: users.map(publicUser),
    plans: plans.map(publicPlan),
    investments: investments.map(publicInvestment),
    transactions: transactions.map(publicTransaction),
    threads: threads.map(publicThread),
    methods: paymentMethods.map(publicPaymentMethod),
  }
}

// ------------------------------------------------------------------ users

export async function listUsers({ query }) {
  const { page, limit, skip, take } = parsePagination(query)

  const where = {}
  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ]
  }
  if (query.status) where.status = query.status
  if (query.role) where.role = query.role

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
  ])

  return { items: users.map(publicUser), meta: buildMeta({ page, limit, total }) }
}

export async function getUser({ id }) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      investments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { plan: true },
      },
      transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      threads: {
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      },
    },
  })

  if (!user) throw ApiError.notFound('User not found.')

  return {
    user: publicUser(user),
    investments: user.investments.map(publicInvestment),
    transactions: user.transactions.map(publicTransaction),
    threads: user.threads.map(publicThread),
  }
}

export async function createUser({ input, actor, req }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) throw ApiError.conflict('An account with that email address already exists.')

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone || null,
      country: input.country || null,
      role: input.role ?? 'USER',
      kycStatus: input.kycStatus ?? 'NOT_STARTED',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'user.create',
    entity: 'User',
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
    ...requestMeta(req),
  })

  return publicUser(user)
}

export async function updateUser({ id, input, actor, req }) {
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) throw ApiError.notFound('User not found.')

  const data = {}
  if (input.firstName !== undefined) data.firstName = input.firstName
  if (input.lastName !== undefined) data.lastName = input.lastName
  if (input.phone !== undefined) data.phone = input.phone || null
  if (input.country !== undefined) data.country = input.country || null
  if (input.kycStatus !== undefined) data.kycStatus = input.kycStatus
  if (input.balance !== undefined) data.balance = toMoney(input.balance)
  if (input.digitalBalance !== undefined) data.digitalBalance = toMoney(input.digitalBalance)
  if (input.totalInvested !== undefined) data.totalInvested = toMoney(input.totalInvested)
  if (input.totalEarnings !== undefined) data.totalEarnings = toMoney(input.totalEarnings)

  const updated = await prisma.user.update({ where: { id }, data })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'user.update',
    entity: 'User',
    entityId: id,
    metadata: { fields: Object.keys(data) },
    ...requestMeta(req),
  })

  return publicUser(updated)
}

export async function suspendUser({ id, input, actor, req }) {
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) throw ApiError.notFound('User not found.')

  const updated = await prisma.user.update({
    where: { id },
    data: { status: 'SUSPENDED', suspendedAt: new Date(), suspensionNote: input.note },
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'user.suspend',
    entity: 'User',
    entityId: id,
    metadata: { note: input.note },
    ...requestMeta(req),
  })

  return publicUser(updated)
}

export async function activateUser({ id, actor, req }) {
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) throw ApiError.notFound('User not found.')

  const updated = await prisma.user.update({
    where: { id },
    data: { status: 'ACTIVE', suspendedAt: null, suspensionNote: null },
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'user.activate',
    entity: 'User',
    entityId: id,
    ...requestMeta(req),
  })

  return publicUser(updated)
}

export async function adjustBalance({ id, input, actor, req }) {
  const amount = toMoney(input.amount)
  const isCredit = input.direction === 'credit'

  const { user, transaction } = await runTransaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id } })
    if (!current) throw ApiError.notFound('User not found.')

    const balance = Number(current.balance) + (isCredit ? 1 : -1) * Number(amount)
    if (balance < 0) {
      throw ApiError.badRequest(
        'That debit is larger than the available balance. Reduce the amount.',
      )
    }

    const totalEarnings = isCredit
      ? Number(current.totalEarnings) + Number(amount)
      : Number(current.totalEarnings)

    const updated = await tx.user.update({
      where: { id },
      data: {
        balance: toMoney(balance),
        // Admin credits are how earnings are granted.
        ...(isCredit ? { totalEarnings: toMoney(totalEarnings) } : {}),
      },
    })

    const reference = await nextReference(tx, 'transaction', 'TXN')
    const created = await tx.transaction.create({
      data: {
        reference,
        userId: id,
        type: 'ADJUSTMENT',
        status: 'COMPLETED',
        amount,
        fee: '0.00',
        netAmount: amount,
        methodLabel: 'Administrator adjustment',
        note: input.note,
        reviewedById: actor.id,
        reviewedAt: new Date(),
      },
    })

    return { user: updated, transaction: created }
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'user.balance_adjust',
    entity: 'User',
    entityId: id,
    metadata: {
      direction: input.direction,
      amount,
      note: input.note,
      transactionId: transaction.id,
    },
    ...requestMeta(req),
  })

  return publicUser(user)
}

export async function deleteUser({ id, actor, req }) {
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) throw ApiError.notFound('User not found.')

  // Related investments, transactions, threads and sessions cascade.
  await prisma.user.delete({ where: { id } })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'user.delete',
    entity: 'User',
    entityId: id,
    metadata: { email: user.email },
    ...requestMeta(req),
  })

  return { message: 'User deleted.' }
}

// ------------------------------------------------------------ transactions

export async function listTransactions({ query }) {
  const { page, limit, skip, take } = parsePagination(query)

  const where = {}
  if (query.status) where.status = query.status
  if (query.type) where.type = query.type
  if (query.search) {
    where.OR = [
      { reference: { contains: query.search, mode: 'insensitive' } },
      { user: { email: { contains: query.search, mode: 'insensitive' } } },
    ]
  }

  const [total, transactions] = await prisma.$transaction([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ])

  return {
    items: transactions.map(publicTransaction),
    meta: buildMeta({ page, limit, total }),
  }
}

export async function approveTransaction({ id, actor, req }) {
  const transaction = await runTransaction(async (tx) => {
    const current = await tx.transaction.findUnique({ where: { id } })
    if (!current) throw ApiError.notFound('Transaction not found.')
    if (current.status !== 'PENDING') {
      throw ApiError.conflict('This request has already been reviewed.')
    }

    const user = await tx.user.findUnique({ where: { id: current.userId } })
    if (!user) throw ApiError.notFound('The account for this request no longer exists.')

    const net = Number(current.netAmount)
    let balance = Number(user.balance)
    let note = current.note

    if (current.type === 'DEPOSIT') {
      balance += net
    } else if (current.type === 'WITHDRAWAL') {
      balance -= net
      if (balance < 0) {
        note = [
          note,
          `Processed against an insufficient balance — account is now overdrawn by ${Math.abs(balance).toFixed(2)}.`,
        ]
          .filter(Boolean)
          .join(' ')
      }
    }

    await tx.user.update({ where: { id: user.id }, data: { balance: toMoney(balance) } })

    return tx.transaction.update({
      where: { id },
      data: { status: 'COMPLETED', reviewedById: actor.id, reviewedAt: new Date(), note },
      include: { user: true },
    })
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'transaction.approve',
    entity: 'Transaction',
    entityId: id,
    metadata: { type: transaction.type, netAmount: toNumber(transaction.netAmount) },
    ...requestMeta(req),
  })

  return publicTransaction(transaction)
}

export async function rejectTransaction({ id, input, actor, req }) {
  const transaction = await runTransaction(async (tx) => {
    const current = await tx.transaction.findUnique({ where: { id } })
    if (!current) throw ApiError.notFound('Transaction not found.')
    if (current.status !== 'PENDING') {
      throw ApiError.conflict('This request has already been reviewed.')
    }

    const note = [current.note, `Rejected: ${input.note}`].filter(Boolean).join(' ')

    return tx.transaction.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: actor.id, reviewedAt: new Date(), note },
      include: { user: true },
    })
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'transaction.reject',
    entity: 'Transaction',
    entityId: id,
    metadata: { note: input.note },
    ...requestMeta(req),
  })

  return publicTransaction(transaction)
}

// -------------------------------------------------------------- investments

export async function listInvestments({ query }) {
  const { page, limit, skip, take } = parsePagination(query)

  const where = {}
  if (query.status) where.status = query.status

  const [total, investments] = await prisma.$transaction([
    prisma.investment.count({ where }),
    prisma.investment.findMany({
      where,
      include: { user: true, plan: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ])

  return {
    items: investments.map(publicInvestment),
    meta: buildMeta({ page, limit, total }),
  }
}

export async function closeInvestment({ id, actor, req }) {
  const investment = await prisma.investment.findUnique({ where: { id } })
  if (!investment) throw ApiError.notFound('Investment not found.')
  if (!['ACTIVE', 'MATURED'].includes(investment.status)) {
    throw ApiError.conflict('Only active or matured investments can be closed.')
  }

  const updated = await prisma.investment.update({
    where: { id },
    data: { status: 'CLOSED', closedAt: new Date() },
    include: { user: true, plan: true },
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'investment.close',
    entity: 'Investment',
    entityId: id,
    ...requestMeta(req),
  })

  return publicInvestment(updated)
}

// ------------------------------------------------------------ investments

/** Resolves a client from either an id or an email so both desks can share it. */
async function resolveClient({ userId, email }) {
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

  if (!user) throw ApiError.notFound('Client not found.')
  return user
}

export async function createInvestment({ input, actor, req }) {
  const client = await resolveClient(input)

  const plan = input.planId
    ? await prisma.plan.findUnique({ where: { id: input.planId } })
    : await prisma.plan.findFirst({ where: { slug: input.planSlug } })

  if (!plan) throw ApiError.notFound('Plan not found.')
  if (plan.status !== 'ACTIVE') throw ApiError.conflict('That plan is not active.')

  const investment = await openInvestment({
    userId: client.id,
    plan,
    amount: input.amount,
    expectedReturn: input.expectedReturn,
    maturesAt: input.maturesAt,
    note: `Allocated by the desk into the ${plan.name} plan.`,
  })

  if (input.status && input.status !== 'ACTIVE') {
    await prisma.investment.update({ where: { id: investment.id }, data: { status: input.status } })
    investment.status = input.status
  }

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'investment.create',
    entity: 'Investment',
    entityId: investment.id,
    metadata: { userId: client.id, planId: plan.id, amount: input.amount },
    ...requestMeta(req),
  })

  return investment
}

export async function updateInvestment({ id, input, actor, req }) {
  const current = await prisma.investment.findUnique({ where: { id } })
  if (!current) throw ApiError.notFound('Investment not found.')

  let roiPercent = toNumber(current.roiPercent)
  let planName = null

  if (input.planId) {
    const plan = await prisma.plan.findUnique({ where: { id: input.planId } })
    if (!plan) throw ApiError.notFound('Plan not found.')
    roiPercent = toNumber(plan.roiPercent)
    planName = plan.name
  }

  const amount = input.amount !== undefined ? Number(input.amount) : toNumber(current.amount)
  const expectedReturn =
    input.expectedReturn !== undefined
      ? toMoney(input.expectedReturn)
      : // Keep the projection honest when the amount or the plan rate moves.
        input.amount !== undefined || input.planId
        ? (amount + (amount * roiPercent) / 100).toFixed(2)
        : undefined

  const updated = await runTransaction(async (tx) => {
    const investment = await tx.investment.findUnique({ where: { id } })
    if (!investment) throw ApiError.notFound('Investment not found.')

    const delta = amount - toNumber(investment.amount)
    if (delta !== 0) {
      const account = await tx.user.findUnique({ where: { id: investment.userId } })
      const nextInvested = toNumber(account.totalInvested) + delta
      if (nextInvested < 0) {
        throw ApiError.badRequest('This change would push the client invested total below zero.')
      }
      await tx.user.update({
        where: { id: investment.userId },
        data: { totalInvested: toMoney(nextInvested) },
      })
    }

    return tx.investment.update({
      where: { id },
      data: {
        ...(input.planId ? { planId: input.planId, roiPercent: roiPercent.toFixed(2) } : {}),
        ...(input.amount !== undefined ? { amount: toMoney(amount) } : {}),
        ...(expectedReturn !== undefined ? { expectedReturn } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.startedAt ? { startedAt: input.startedAt } : {}),
        ...(input.maturesAt ? { maturesAt: input.maturesAt } : {}),
      },
      include: { user: true, plan: true },
    })
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'investment.update',
    entity: 'Investment',
    entityId: id,
    metadata: { fields: Object.keys(input), planName },
    ...requestMeta(req),
  })

  return publicInvestment(updated)
}

// ------------------------------------------------------------- transactions

export async function createTransaction({ input, actor, req }) {
  const client = await resolveClient(input)
  const amount = Number(input.amount)
  const fee = input.fee !== undefined ? Number(input.fee) : 0

  if (input.reference) {
    const clash = await prisma.transaction.findUnique({ where: { reference: input.reference } })
    if (clash) throw ApiError.conflict('That reference is already in use.')
  }

  const created = await runTransaction(async (tx) => {
    const reference = input.reference || (await nextReference(tx, 'transaction', 'TXN'))
    return tx.transaction.create({
      data: {
        reference,
        userId: client.id,
        type: input.type,
        status: input.status ?? 'COMPLETED',
        amount: toMoney(amount),
        fee: toMoney(fee),
        netAmount: toMoney(amount - fee),
        methodLabel: input.method || null,
        note: input.note || null,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      },
      include: { user: true },
    })
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'transaction.create',
    entity: 'Transaction',
    entityId: created.id,
    metadata: { userId: client.id, type: input.type, amount },
    ...requestMeta(req),
  })

  return publicTransaction(created)
}

export async function updateTransaction({ id, input, actor, req }) {
  const current = await prisma.transaction.findUnique({ where: { id } })
  if (!current) throw ApiError.notFound('Transaction not found.')

  // Money only moves through the explicit balance actions, so a desk edit can
  // never silently release a pending funding request.
  if (
    input.status === 'COMPLETED' &&
    current.status !== 'COMPLETED' &&
    ['DEPOSIT', 'WITHDRAWAL'].includes(current.type)
  ) {
    throw ApiError.badRequest('Approve the request instead — approving is what releases the funds.')
  }

  const amount = input.amount !== undefined ? Number(input.amount) : toNumber(current.amount)
  const fee = input.fee !== undefined ? Number(input.fee) : toNumber(current.fee)

  if (input.reference && input.reference !== current.reference) {
    const clash = await prisma.transaction.findUnique({ where: { reference: input.reference } })
    if (clash) throw ApiError.conflict('That reference is already in use.')
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      ...(input.type ? { type: input.type } : {}),
      ...(input.amount !== undefined ? { amount: toMoney(amount) } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.fee !== undefined ? { fee: toMoney(fee) } : {}),
      ...(input.amount !== undefined || input.fee !== undefined
        ? { netAmount: toMoney(amount - fee) }
        : {}),
      ...(input.reference ? { reference: input.reference } : {}),
      ...(input.method !== undefined ? { methodLabel: input.method || null } : {}),
      ...(input.note !== undefined ? { note: input.note || null } : {}),
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
    include: { user: true },
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'transaction.update',
    entity: 'Transaction',
    entityId: id,
    metadata: { fields: Object.keys(input) },
    ...requestMeta(req),
  })

  return publicTransaction(updated)
}

export async function deleteTransaction({ id, actor, req }) {
  const transaction = await prisma.transaction.findUnique({ where: { id } })
  if (!transaction) throw ApiError.notFound('Transaction not found.')

  await prisma.transaction.delete({ where: { id } })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'transaction.delete',
    entity: 'Transaction',
    entityId: id,
    metadata: { reference: transaction.reference, type: transaction.type },
    ...requestMeta(req),
  })

  return { id, deleted: true }
}

// ----------------------------------------------------------------- support

export async function listThreads({ query }) {
  const { page, limit, skip, take } = parsePagination(query)

  const where = {}
  if (query.status) where.status = query.status
  if (query.search) {
    where.OR = [
      { reference: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { subject: { contains: query.search, mode: 'insensitive' } },
      { messages: { some: { body: { contains: query.search, mode: 'insensitive' } } } },
    ]
  }

  const [total, threads] = await prisma.$transaction([
    prisma.supportThread.count({ where }),
    prisma.supportThread.findMany({
      where,
      include: { user: true, messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
    }),
  ])

  return { items: threads.map(publicThread), meta: buildMeta({ page, limit, total }) }
}

export async function replyToThread({ id, input, actor, req }) {
  const thread = await prisma.supportThread.findUnique({ where: { id } })
  if (!thread) throw ApiError.notFound('Support thread not found.')

  const updated = await runTransaction(async (tx) => {
    await tx.supportMessage.create({
      data: { threadId: id, authorRole: 'ADMIN', authorId: actor.id, body: input.body },
    })
    return tx.supportThread.update({
      where: { id },
      data: { status: 'PENDING', updatedAt: new Date() },
      include: { user: true, messages: { orderBy: { createdAt: 'asc' } } },
    })
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'support.reply',
    entity: 'SupportThread',
    entityId: id,
    ...requestMeta(req),
  })

  const recipient = updated.email || updated.user?.email
  if (recipient) {
    const { subject, html } = renderSupportReplyEmail({
      firstName: updated.user?.firstName || 'there',
      thread: updated,
      body: input.body,
    })
    await sendMailSafe({ to: recipient, subject, html })
  }

  return publicThread(updated)
}

export async function updateThread({ id, input, actor, req }) {
  const thread = await prisma.supportThread.findUnique({ where: { id } })
  if (!thread) throw ApiError.notFound('Support thread not found.')

  const updated = await prisma.supportThread.update({
    where: { id },
    data: { status: input.status, updatedAt: new Date() },
    include: { user: true, messages: { orderBy: { createdAt: 'asc' } } },
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'support.update',
    entity: 'SupportThread',
    entityId: id,
    metadata: { status: input.status },
    ...requestMeta(req),
  })

  return publicThread(updated)
}

export async function deleteThread({ id, actor, req }) {
  const thread = await prisma.supportThread.findUnique({ where: { id } })
  if (!thread) throw ApiError.notFound('Support thread not found.')

  await prisma.supportThread.delete({ where: { id } })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'support.delete',
    entity: 'SupportThread',
    entityId: id,
    metadata: { reference: thread.reference },
    ...requestMeta(req),
  })

  return { message: 'Support thread deleted.' }
}

// ------------------------------------------------------------------- plans

export async function listPlans() {
  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } })
  return plans.map(publicPlan)
}

export async function createPlan({ input, actor, req }) {
  const plan = await prisma.plan.create({
    data: {
      name: input.name,
      slug: input.slug,
      summary: input.summary,
      description: input.description,
      minAmount: toMoney(input.minAmount),
      maxAmount: toMoney(input.maxAmount),
      roiPercent: toMoney(input.roiPercent),
      durationDays: input.durationDays,
      payoutFrequency: input.payoutFrequency ?? 'AT_MATURITY',
      riskLevel: input.riskLevel ?? 'MODERATE',
      status: input.status ?? 'ACTIVE',
      sortOrder: input.sortOrder ?? 0,
    },
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'plan.create',
    entity: 'Plan',
    entityId: plan.id,
    metadata: { slug: plan.slug },
    ...requestMeta(req),
  })

  return publicPlan(plan)
}

export async function updatePlan({ id, input, actor, req }) {
  const plan = await prisma.plan.findUnique({ where: { id } })
  if (!plan) throw ApiError.notFound('Plan not found.')

  const data = {}
  for (const key of ['name', 'slug', 'summary', 'description']) {
    if (input[key] !== undefined) data[key] = input[key]
  }
  for (const key of ['minAmount', 'maxAmount', 'roiPercent']) {
    if (input[key] !== undefined) data[key] = toMoney(input[key])
  }
  for (const key of ['durationDays', 'payoutFrequency', 'riskLevel', 'status', 'sortOrder']) {
    if (input[key] !== undefined) data[key] = input[key]
  }

  const updated = await prisma.plan.update({ where: { id }, data })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'plan.update',
    entity: 'Plan',
    entityId: id,
    metadata: { fields: Object.keys(data) },
    ...requestMeta(req),
  })

  return publicPlan(updated)
}

export async function deletePlan({ id, actor, req }) {
  const plan = await prisma.plan.findUnique({ where: { id } })
  if (!plan) throw ApiError.notFound('Plan not found.')

  const attached = await prisma.investment.count({ where: { planId: id } })
  if (attached > 0) {
    throw ApiError.conflict(
      'This plan still has investments attached and cannot be deleted. Pause or archive it instead.',
    )
  }

  await prisma.plan.delete({ where: { id } })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'plan.delete',
    entity: 'Plan',
    entityId: id,
    metadata: { slug: plan.slug },
    ...requestMeta(req),
  })

  return { message: 'Plan deleted.' }
}

// --------------------------------------------------------- funding methods

export async function listPaymentMethods() {
  const methods = await prisma.paymentMethod.findMany({ orderBy: { sortOrder: 'asc' } })
  return methods.map(publicPaymentMethod)
}

export async function createPaymentMethod({ input, actor, req }) {
  const method = await prisma.paymentMethod.create({
    data: {
      label: input.label,
      kind: input.kind,
      network: orNull(input.network),
      address: orNull(input.address),
      bankName: orNull(input.bankName),
      accountName: orNull(input.accountName),
      accountNumber: orNull(input.accountNumber),
      swiftCode: orNull(input.swiftCode),
      instructions: orNull(input.instructions),
      status: input.status ?? 'ACTIVE',
      sortOrder: input.sortOrder ?? 0,
    },
  })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'payment_method.create',
    entity: 'PaymentMethod',
    entityId: method.id,
    metadata: { label: method.label },
    ...requestMeta(req),
  })

  return publicPaymentMethod(method)
}

export async function updatePaymentMethod({ id, input, actor, req }) {
  const method = await prisma.paymentMethod.findUnique({ where: { id } })
  if (!method) throw ApiError.notFound('Funding method not found.')

  // Only the supplied keys are written; anything omitted keeps its stored value.
  const data = {}
  for (const key of ['label', 'kind']) {
    if (input[key] !== undefined) data[key] = input[key]
  }
  for (const key of [
    'network',
    'address',
    'bankName',
    'accountName',
    'accountNumber',
    'swiftCode',
    'instructions',
  ]) {
    if (input[key] !== undefined) data[key] = orNull(input[key])
  }
  for (const key of ['status', 'sortOrder']) {
    if (input[key] !== undefined) data[key] = input[key]
  }

  const updated = await prisma.paymentMethod.update({ where: { id }, data })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'payment_method.update',
    entity: 'PaymentMethod',
    entityId: id,
    metadata: { label: updated.label },
    ...requestMeta(req),
  })

  return publicPaymentMethod(updated)
}

export async function deletePaymentMethod({ id, actor, req }) {
  const method = await prisma.paymentMethod.findUnique({ where: { id } })
  if (!method) throw ApiError.notFound('Funding method not found.')

  await prisma.paymentMethod.delete({ where: { id } })

  await recordAudit({
    actorId: actor.id,
    actorRole: actor.role,
    action: 'payment_method.delete',
    entity: 'PaymentMethod',
    entityId: id,
    metadata: { label: method.label },
    ...requestMeta(req),
  })

  return { message: 'Funding method deleted.' }
}

// -------------------------------------------------------------- audit logs

export async function listAuditLogs({ query }) {
  const { page, limit, skip, take } = parsePagination(query)

  const where = {}
  if (query.search) {
    where.OR = [
      { action: { contains: query.search, mode: 'insensitive' } },
      { entity: { contains: query.search, mode: 'insensitive' } },
      { actor: { email: { contains: query.search, mode: 'insensitive' } } },
    ]
  }

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ])

  return {
    items: logs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      actorRole: log.actorRole,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
      actor: log.actor
        ? {
            id: log.actor.id,
            email: log.actor.email,
            name: `${log.actor.firstName} ${log.actor.lastName}`.trim(),
          }
        : null,
    })),
    meta: buildMeta({ page, limit, total }),
  }
}
