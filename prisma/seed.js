/**
 * Seed script — idempotent. Safe to run repeatedly.
 *
 *   npm run db:seed
 *
 * Creates: the bootstrap admin, the plan catalogue, funding rails,
 * a couple of demo clients (only when the database has no investments yet).
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12)

const PLANS = [
  {
    name: 'Foundation',
    slug: 'foundation',
    summary: 'Capital preservation with a measured income return.',
    description:
      'A conservative entry portfolio built on investment-grade fixed income and short-duration credit. Designed for investors who want steady, predictable income with limited drawdown.',
    minAmount: '1000.00',
    maxAmount: '25000.00',
    roiPercent: '6.50',
    durationDays: 90,
    payoutFrequency: 'MONTHLY',
    riskLevel: 'LOW',
    sortOrder: 1,
  },
  {
    name: 'Balanced Income',
    slug: 'balanced-income',
    summary: 'Blended exposure across credit and listed equities.',
    description:
      'A diversified mandate that pairs investment-grade credit with dividend-paying listed equity. Positioned for investors seeking income plus moderate capital appreciation.',
    minAmount: '25000.00',
    maxAmount: '150000.00',
    roiPercent: '9.20',
    durationDays: 180,
    payoutFrequency: 'MONTHLY',
    riskLevel: 'MODERATE',
    sortOrder: 2,
  },
  {
    name: 'Growth',
    slug: 'growth',
    summary: 'Longer horizon, higher expected return.',
    description:
      'A growth-oriented mandate across private credit and infrastructure. Capital is committed for a longer term in exchange for a higher target return.',
    minAmount: '50000.00',
    maxAmount: '500000.00',
    roiPercent: '13.40',
    durationDays: 365,
    payoutFrequency: 'AT_MATURITY',
    riskLevel: 'MODERATE',
    sortOrder: 3,
  },
  {
    name: 'Private Markets',
    slug: 'private-markets',
    summary: 'Direct co-investment in curated private transactions.',
    description:
      'Access to negotiated private-market transactions alongside the firm. Highest target return in the range, with correspondingly higher risk and longer lock-up.',
    minAmount: '250000.00',
    maxAmount: '5000000.00',
    roiPercent: '18.00',
    durationDays: 730,
    payoutFrequency: 'AT_MATURITY',
    riskLevel: 'HIGH',
    sortOrder: 4,
  },
]

const PAYMENT_METHODS = [
  {
    label: 'USD Wire Transfer',
    kind: 'bank_transfer',
    bankName: 'JPMorgan Chase Bank, N.A.',
    accountName: 'Colbert Capital Client Trust',
    accountNumber: '8842 1190 3377',
    swiftCode: 'CHASUS33',
    instructions:
      'Include your transaction reference in the wire memo. Funds are credited after bank confirmation, usually within one business day.',
    sortOrder: 1,
  },
  {
    label: 'USDT (TRC-20)',
    kind: 'crypto',
    network: 'Tron / TRC-20',
    address: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
    instructions:
      'Send only USDT on the TRC-20 network to this address. Transfers on any other network cannot be recovered.',
    sortOrder: 2,
  },
  {
    label: 'Bitcoin (BTC)',
    kind: 'crypto',
    network: 'Bitcoin',
    address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    instructions:
      'Send only BTC to this address. One network confirmation is required before crediting.',
    sortOrder: 3,
  },
  {
    label: 'Debit / Credit Card',
    kind: 'card',
    instructions:
      'Card funding is processed through a regulated payment processor and settles within 24 hours.',
    sortOrder: 4,
  },
]

const DEMO_CLIENTS = [
  {
    email: 'client@colbertcapital.org',
    password: 'Client123!',
    firstName: 'Adaeze',
    lastName: 'Okonkwo',
    country: 'Nigeria',
    phone: '+234 802 555 0134',
    status: 'ACTIVE',
    balance: '18450.75',
    totalInvested: '60000.00',
    totalEarnings: '3120.40',
    kycStatus: 'VERIFIED',
  },
  {
    email: 'marcus.whitfield@example.com',
    password: 'Client123!',
    firstName: 'Marcus',
    lastName: 'Whitfield',
    country: 'United Kingdom',
    phone: '+44 7700 900312',
    status: 'ACTIVE',
    balance: '6290.10',
    totalInvested: '120000.00',
    totalEarnings: '7440.00',
    kycStatus: 'PENDING',
  },
  {
    email: 'danielle.reyes@example.com',
    password: 'Client123!',
    firstName: 'Danielle',
    lastName: 'Reyes',
    country: 'United States',
    phone: '+1 415 555 0188',
    status: 'ACTIVE',
    balance: '2380.00',
    totalInvested: '25000.00',
    totalEarnings: '985.50',
    kycStatus: 'VERIFIED',
  },
]

async function nextCounter(key, tx) {
  const client = tx ?? prisma
  const record = await client.counter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  })
  return record.value
}

function pad(value) {
  return String(value).padStart(4, '0')
}

async function seedAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.warn('[seed] ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin.')
    return
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date() },
    create: {
      email,
      passwordHash,
      firstName: process.env.ADMIN_FIRST_NAME || 'Colbert',
      lastName: process.env.ADMIN_LAST_NAME || 'Operations',
      role: 'ADMIN',
      status: 'ACTIVE',
      kycStatus: 'VERIFIED',
      emailVerifiedAt: new Date(),
    },
  })

  console.log(`[seed] admin ready: ${admin.email}`)
}

async function seedPlans() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    })
  }
  console.log(`[seed] plans ready: ${PLANS.length}`)
}

async function seedPaymentMethods() {
  for (const method of PAYMENT_METHODS) {
    const existing = await prisma.paymentMethod.findFirst({ where: { label: method.label } })
    if (existing) {
      await prisma.paymentMethod.update({ where: { id: existing.id }, data: method })
    } else {
      await prisma.paymentMethod.create({ data: method })
    }
  }
  console.log(`[seed] funding rails ready: ${PAYMENT_METHODS.length}`)
}

async function seedDemoData() {
  const existing = await prisma.investment.count()
  if (existing > 0) {
    console.log('[seed] investments already present — skipping demo clients.')
    return
  }

  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } })
  const bySlug = Object.fromEntries(plans.map((plan) => [plan.slug, plan]))

  const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  for (const client of DEMO_CLIENTS) {
    const { password, ...profile } = client
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    const user = await prisma.user.upsert({
      where: { email: profile.email },
      update: {},
      create: { ...profile, passwordHash, emailVerifiedAt: new Date() },
    })

    const already = await prisma.investment.count({ where: { userId: user.id } })
    if (already > 0) continue

    const allocation = [
      { slug: 'balanced-income', amount: '60000.00' },
      { slug: 'foundation', amount: '10000.00' },
    ]

    for (const entry of allocation) {
      const plan = bySlug[entry.slug]
      if (!plan) continue
      const reference = `INV-${pad(await nextCounter('investment'))}`
      const roi = Number(plan.roiPercent)
      const amount = Number(entry.amount)
      await prisma.investment.create({
        data: {
          reference,
          userId: user.id,
          planId: plan.id,
          amount: entry.amount,
          roiPercent: plan.roiPercent,
          expectedReturn: (amount + (amount * roi) / 100).toFixed(2),
          status: 'ACTIVE',
          startedAt: daysAgo(30),
          maturesAt: daysFromNow(plan.durationDays - 30),
        },
      })
    }

    const deposits = [
      { amount: '25000.00', status: 'COMPLETED', type: 'DEPOSIT', created: daysAgo(40) },
      { amount: '12000.00', status: 'APPROVED', type: 'DEPOSIT', created: daysAgo(12) },
      { amount: '4000.00', status: 'PENDING', type: 'WITHDRAWAL', created: daysAgo(2) },
    ]

    for (const entry of deposits) {
      const reference = `TXN-${pad(await nextCounter('transaction'))}`
      await prisma.transaction.create({
        data: {
          reference,
          userId: user.id,
          type: entry.type,
          status: entry.status,
          amount: entry.amount,
          fee: '0.00',
          netAmount: entry.amount,
          methodLabel: entry.type === 'WITHDRAWAL' ? 'USD Wire Transfer' : 'USDT (TRC-20)',
          createdAt: entry.created,
        },
      })
    }
  }

  const primary = await prisma.user.findUnique({ where: { email: DEMO_CLIENTS[0].email } })
  if (!primary) return

  const threads = [
    {
      subject: 'Wire deposit not showing yet',
      topic: 'DEPOSIT',
      priority: 'HIGH',
      status: 'OPEN',
      messages: [
        {
          authorRole: 'CLIENT',
          body: 'I sent a wire on Monday and it still has not reflected in my balance. Could someone confirm receipt?',
        },
      ],
    },
    {
      subject: 'Withdrawal destination update',
      topic: 'WITHDRAWAL',
      priority: 'NORMAL',
      status: 'PENDING',
      messages: [
        { authorRole: 'CLIENT', body: 'I need to change the bank account on my withdrawal request.' },
        {
          authorRole: 'ADMIN',
          body: 'Noted. Please confirm the new account details and we will update the request before processing.',
        },
      ],
    },
  ]

  for (const thread of threads) {
    const reference = `TKT-${pad(await nextCounter('support'))}`
    await prisma.supportThread.create({
      data: {
        reference,
        userId: primary.id,
        email: primary.email,
        clientName: `${primary.firstName} ${primary.lastName}`,
        subject: thread.subject,
        topic: thread.topic,
        priority: thread.priority,
        status: thread.status,
        messages: { create: thread.messages },
      },
    })
  }

  console.log('[seed] demo clients, portfolios and tickets ready')
}

async function main() {
  console.log('[seed] starting')
  await seedAdmin()
  await seedPlans()
  await seedPaymentMethods()
  await seedDemoData()
  console.log('[seed] complete')
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
