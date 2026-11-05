import { z } from 'zod'

export const listPositionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
})

export const buyPositionSchema = z.object({
  symbol: z.string().trim().min(1).max(16).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(120),
  exchange: z.string().trim().max(80).optional(),
  assetType: z.string().trim().max(40).optional(),
  quantity: z.coerce.number().positive('Enter a share quantity greater than zero.'),
  price: z.coerce.number().positive('Enter a valid live price.'),
})
