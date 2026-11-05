import { z } from 'zod'

export const createInvestmentSchema = z.object({
  planSlug: z.string().trim().min(1),
  amount: z.coerce.number().positive('Enter an amount greater than zero.'),
})

export const listInvestmentsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'MATURED', 'CLOSED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
})
