import { z } from 'zod'

const transactionType = z.enum([
  'DEPOSIT',
  'WITHDRAWAL',
  'INVESTMENT',
  'EARNING',
  'PAYOUT',
  'ADJUSTMENT',
])

const transactionStatus = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'FAILED',
])

const page = z.coerce.number().int().positive().optional()
const limit = z.coerce.number().int().positive().optional()

const amount = z.coerce.number().positive('Enter an amount greater than zero.')

const currency = z
  .string()
  .trim()
  .length(3, 'Enter a 3 letter currency code.')
  .transform((value) => value.toUpperCase())
  .default('USD')

export const listTransactionsQuerySchema = z.object({
  type: transactionType.optional(),
  status: transactionStatus.optional(),
  page,
  limit,
})

export const transactionIdParamsSchema = z.object({
  id: z.string().trim().min(1),
})

export const depositSchema = z.object({
  amount,
  currency,
  methodLabel: z
    .string()
    .trim()
    .min(2, 'Give the payment method a name.')
    .max(80, 'That payment method name is too long.'),
  walletAddress: z.string().trim().max(200, 'That wallet address is too long.').optional(),
  note: z.string().trim().max(300, 'That note is too long.').optional(),
})

export const withdrawalSchema = z.object({
  amount,
  currency,
  methodLabel: z
    .string()
    .trim()
    .min(2, 'Give the payout method a name.')
    .max(80, 'That payout method name is too long.'),
  destinationName: z
    .string()
    .trim()
    .min(2, 'Enter the account holder name.')
    .max(120, 'That name is too long.'),
  destinationDetails: z
    .string()
    .trim()
    .min(3, 'Enter the payout destination details.')
    .max(300, 'Those destination details are too long.'),
  note: z.string().trim().max(300, 'That note is too long.').optional(),
})
