import { z } from 'zod'

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter your name.')
    .max(120, 'Name is too long.'),
  email: z
    .string()
    .email('Please enter a valid email address.')
    .transform((value) => value.trim().toLowerCase()),
  company: z
    .string()
    .trim()
    .min(2, 'Please enter your company.')
    .max(160, 'Company is too long.'),
  inquiryType: z
    .string()
    .trim()
    .min(2, 'Please select an inquiry type.')
    .max(80, 'Inquiry type is too long.'),
  region: z
    .string()
    .trim()
    .min(2, 'Please select a region.')
    .max(80, 'Region is too long.'),
  message: z
    .string()
    .trim()
    .min(20, 'Please tell us a little more (at least 20 characters).')
    .max(4000, 'Message is too long.'),
  turnstileToken: z.string().max(4000).optional(),
})
