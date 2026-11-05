import { z } from 'zod'
import { passwordSchema } from '../../lib/password.js'

const email = z
  .string()
  .email('Please enter a valid email address.')
  .transform((value) => value.trim().toLowerCase())

const code = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6 digit code.')

const name = (label) =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters.`)
    .max(60, `${label} is too long.`)

const otpPurpose = z.enum(['EMAIL_VERIFICATION', 'LOGIN', 'RESET_PASSWORD'])

export const registerSchema = z.object({
  email,
  password: passwordSchema,
  firstName: name('First name'),
  lastName: name('Last name'),
  phone: z.string().trim().max(32).optional().or(z.literal('')),
  country: z.string().trim().max(64).optional().or(z.literal('')),
})

export const verifyEmailSchema = z.object({
  email,
  code,
})

export const resendOtpSchema = z.object({
  email,
  purpose: otpPurpose,
})

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
})

export const loginVerifySchema = z.object({
  email,
  code,
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, 'A refresh token is required.'),
})

export const logoutSchema = z.object({
  refreshToken: z.string().min(20).optional(),
})

export const forgotPasswordSchema = z.object({
  email,
})

export const resetPasswordSchema = z.object({
  email,
  code,
  password: passwordSchema,
})
