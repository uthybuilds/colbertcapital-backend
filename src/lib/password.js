import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { env } from '../config/env.js'

export function hashPassword(plain) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS)
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

/**
 * Password policy: 8-72 chars (bcrypt truncates past 72 bytes), at least one
 * letter and one number.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .regex(/[A-Za-z]/, 'Password must contain a letter.')
  .regex(/[0-9]/, 'Password must contain a number.')
