import { z } from 'zod'

export const createThreadSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(4, 'Enter a subject of at least 4 characters.')
    .max(140, 'That subject is too long.'),
  topic: z.enum(['DEPOSIT', 'WITHDRAWAL', 'INVESTMENT', 'ACCOUNT', 'OTHER']),
  priority: z.enum(['NORMAL', 'HIGH']).optional(),
  body: z
    .string()
    .trim()
    .min(10, 'Describe your issue in at least 10 characters.')
    .max(4000, 'That message is too long.'),
})

export const replySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Enter a message.')
    .max(4000, 'That message is too long.'),
})

export const threadIdParamsSchema = z.object({
  id: z.string().trim().min(1),
})
