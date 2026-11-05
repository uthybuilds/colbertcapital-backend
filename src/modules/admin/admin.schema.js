import { z } from 'zod'
import { passwordSchema } from '../../lib/password.js'

const email = z
  .string()
  .email('Please enter a valid email address.')
  .transform((value) => value.trim().toLowerCase())

const name = (label) =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters.`)
    .max(60, `${label} is too long.`)

const optionalText = (max) => z.string().trim().max(max).optional().or(z.literal(''))

const role = z.enum(['USER', 'ADMIN'])
const kycStatus = z.enum(['NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED'])
const planStatus = z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED'])
const payoutFrequency = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'AT_MATURITY'])
const riskLevel = z.enum(['LOW', 'MODERATE', 'HIGH'])
const paymentStatus = z.enum(['ACTIVE', 'INACTIVE'])
const supportStatus = z.enum(['OPEN', 'PENDING', 'RESOLVED'])

const slug = z
  .string()
  .trim()
  .min(2, 'Slug must be at least 2 characters.')
  .max(120, 'Slug is too long.')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.')

const note = z.string().trim().min(3, 'Please add a short note.').max(300, 'Note is too long.')

const money = z.coerce.number().min(0, 'Amounts cannot be negative.').max(1_000_000_000)
const positiveMoney = z.coerce.number().positive('Enter an amount greater than zero.').max(1_000_000_000)

const investmentStatus = z.enum(['ACTIVE', 'MATURED', 'CLOSED', 'CANCELLED'])
const transactionType = z.enum([
  'DEPOSIT',
  'WITHDRAWAL',
  'INVESTMENT',
  'EARNING',
  'PAYOUT',
  'ADJUSTMENT',
])
const transactionStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'FAILED'])

// -------------------------------------------------------------- shared lists

export const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  type: z.string().trim().max(40).optional(),
  role: role.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export const idParamSchema = z.object({
  id: z.string().trim().min(1, 'A valid id is required.'),
})

// --------------------------------------------------------------------- users

export const createUserSchema = z.object({
  email,
  password: passwordSchema,
  firstName: name('First name'),
  lastName: name('Last name'),
  phone: optionalText(32),
  country: optionalText(64),
  role: role.optional(),
  kycStatus: kycStatus.optional(),
})

export const updateUserSchema = z.object({
  firstName: name('First name').optional(),
  lastName: name('Last name').optional(),
  phone: optionalText(32),
  country: optionalText(64),
  kycStatus: kycStatus.optional(),
  // Reported figures are edited directly by the desk.
  balance: money.optional(),
  digitalBalance: money.optional(),
  totalInvested: money.optional(),
  totalEarnings: money.optional(),
})

export const suspendSchema = z.object({ note })

export const balanceSchema = z.object({
  direction: z.enum(['credit', 'debit']),
  amount: positiveMoney,
  note,
})

// --------------------------------------------------- client-scoped payloads

const clientRef = {
  userId: z.string().trim().min(1).optional(),
  email: email.optional(),
}

const requiresClient = (value) => Boolean(value.userId || value.email)

export const createTransactionSchema = z
  .object({
    ...clientRef,
    type: transactionType,
    amount: positiveMoney,
    status: transactionStatus.optional(),
    fee: money.optional(),
    reference: optionalText(64),
    method: optionalText(120),
    note: optionalText(300),
    createdAt: z.coerce.date().optional(),
  })
  .refine(requiresClient, { message: 'Select a client.' })

export const updateTransactionSchema = z
  .object({
    type: transactionType.optional(),
    amount: positiveMoney.optional(),
    status: transactionStatus.optional(),
    fee: money.optional(),
    reference: optionalText(64),
    method: optionalText(120),
    note: optionalText(300),
    createdAt: z.coerce.date().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  })

export const createInvestmentSchema = z
  .object({
    ...clientRef,
    planId: z.string().trim().min(1).optional(),
    planSlug: z.string().trim().min(2).optional(),
    amount: positiveMoney,
    expectedReturn: money.optional(),
    maturesAt: z.coerce.date().optional(),
    status: investmentStatus.optional(),
  })
  .refine(requiresClient, { message: 'Select a client.' })
  .refine((value) => Boolean(value.planId || value.planSlug), { message: 'Select a plan.' })

export const updateInvestmentSchema = z
  .object({
    planId: z.string().trim().min(1).optional(),
    amount: positiveMoney.optional(),
    expectedReturn: money.optional(),
    status: investmentStatus.optional(),
    startedAt: z.coerce.date().optional(),
    maturesAt: z.coerce.date().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  })

// -------------------------------------------------------------- transactions

export const rejectSchema = z.object({ note })

// --------------------------------------------------------------------- plans

export const createPlanSchema = z.object({
  name: z.string().trim().min(2, 'Plan name is required.').max(120),
  slug,
  summary: z.string().trim().min(2, 'Summary is required.').max(280),
  description: z.string().trim().min(20, 'Description is too short.').max(5000),
  minAmount: z.coerce.number().positive('Minimum amount must be greater than zero.'),
  maxAmount: z.coerce.number().positive('Maximum amount must be greater than zero.'),
  roiPercent: z.coerce.number().positive().max(1000),
  durationDays: z.coerce.number().int().positive(),
  payoutFrequency: payoutFrequency.optional(),
  riskLevel: riskLevel.optional(),
  status: planStatus.optional(),
  sortOrder: z.coerce.number().int().optional(),
})

export const updatePlanSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  slug: slug.optional(),
  summary: z.string().trim().min(2).max(280).optional(),
  description: z.string().trim().min(20).max(5000).optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
  roiPercent: z.coerce.number().positive().max(1000).optional(),
  durationDays: z.coerce.number().int().positive().optional(),
  payoutFrequency: payoutFrequency.optional(),
  riskLevel: riskLevel.optional(),
  status: planStatus.optional(),
  sortOrder: z.coerce.number().int().optional(),
})

// ----------------------------------------------------------- funding methods

export const paymentMethodSchema = z.object({
  label: z.string().trim().min(2, 'A label is required.').max(120),
  kind: z.string().trim().min(2, 'A kind is required.').max(40),
  network: optionalText(120),
  address: optionalText(255),
  bankName: optionalText(160),
  accountName: optionalText(160),
  accountNumber: optionalText(80),
  swiftCode: optionalText(40),
  instructions: optionalText(2000),
  status: paymentStatus.optional(),
  sortOrder: z.coerce.number().int().optional(),
})

/** Partial edit — omitted fields keep their stored value instead of being cleared. */
export const updatePaymentMethodSchema = paymentMethodSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  })

// ------------------------------------------------------------------- support

export const replySchema = z.object({
  body: z.string().trim().min(1, 'Write a reply.').max(4000, 'Reply is too long.'),
})

export const threadStatusSchema = z.object({
  status: supportStatus,
})
