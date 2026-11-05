/**
 * Shapes Prisma records into API payloads.
 * Prisma returns DECIMAL columns as Decimal objects; clients get numbers.
 */

export function toNumber(value) {
  if (value === null || value === undefined) return value
  if (typeof value === 'number') return value
  return Number(value.toString())
}

export function publicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    phone: user.phone,
    country: user.country,
    role: user.role,
    status: user.status,
    kycStatus: user.kycStatus,
    emailVerified: Boolean(user.emailVerifiedAt),
    balance: toNumber(user.balance),
    digitalBalance: toNumber(user.digitalBalance),
    totalInvested: toNumber(user.totalInvested),
    totalEarnings: toNumber(user.totalEarnings),
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  }
}

export function publicPlan(plan) {
  if (!plan) return null
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    summary: plan.summary,
    description: plan.description,
    minAmount: toNumber(plan.minAmount),
    maxAmount: toNumber(plan.maxAmount),
    roiPercent: toNumber(plan.roiPercent),
    durationDays: plan.durationDays,
    payoutFrequency: plan.payoutFrequency,
    riskLevel: plan.riskLevel,
    status: plan.status,
    sortOrder: plan.sortOrder,
  }
}

export function publicInvestment(investment) {
  if (!investment) return null
  return {
    id: investment.id,
    reference: investment.reference,
    amount: toNumber(investment.amount),
    roiPercent: toNumber(investment.roiPercent),
    expectedReturn: toNumber(investment.expectedReturn),
    status: investment.status,
    startedAt: investment.startedAt,
    maturesAt: investment.maturesAt,
    closedAt: investment.closedAt,
    plan: investment.plan ? publicPlan(investment.plan) : undefined,
    user: investment.user ? publicUser(investment.user) : undefined,
  }
}

export function publicMarketPosition(position) {
  if (!position) return null
  return {
    id: position.id,
    symbol: position.symbol,
    name: position.name,
    exchange: position.exchange,
    assetType: position.assetType,
    quantity: toNumber(position.quantity),
    averagePrice: toNumber(position.averagePrice),
    costBasis: toNumber(position.costBasis),
    createdAt: position.createdAt,
    updatedAt: position.updatedAt,
  }
}

export function publicTransaction(transaction) {
  if (!transaction) return null
  return {
    id: transaction.id,
    reference: transaction.reference,
    type: transaction.type,
    status: transaction.status,
    amount: toNumber(transaction.amount),
    fee: toNumber(transaction.fee),
    netAmount: toNumber(transaction.netAmount),
    currency: transaction.currency,
    methodLabel: transaction.methodLabel,
    walletAddress: transaction.walletAddress,
    destinationName: transaction.destinationName,
    destinationDetails: transaction.destinationDetails,
    note: transaction.note,
    reviewedAt: transaction.reviewedAt,
    createdAt: transaction.createdAt,
    user: transaction.user ? publicUser(transaction.user) : undefined,
  }
}

export function publicThread(thread) {
  if (!thread) return null
  return {
    id: thread.id,
    reference: thread.reference,
    email: thread.email,
    clientName: thread.clientName,
    subject: thread.subject,
    topic: thread.topic,
    priority: thread.priority,
    status: thread.status,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    user: thread.user ? publicUser(thread.user) : undefined,
    messages: (thread.messages || []).map(publicMessage),
    messageCount: thread._count?.messages ?? thread.messages?.length ?? 0,
  }
}

export function publicMessage(message) {
  if (!message) return null
  return {
    id: message.id,
    authorRole: message.authorRole,
    authorId: message.authorId,
    body: message.body,
    createdAt: message.createdAt,
  }
}

export function publicPaymentMethod(method) {
  if (!method) return null
  return {
    id: method.id,
    label: method.label,
    kind: method.kind,
    network: method.network,
    address: method.address,
    bankName: method.bankName,
    accountName: method.accountName,
    accountNumber: method.accountNumber,
    swiftCode: method.swiftCode,
    instructions: method.instructions,
    status: method.status,
    sortOrder: method.sortOrder,
  }
}
