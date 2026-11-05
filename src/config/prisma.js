import { AsyncLocalStorage } from 'node:async_hooks'
import { PrismaClient } from '@prisma/client'
import { env } from './env.js'
import { logger } from './logger.js'

/**
 * Single PrismaClient for the process. The dev server reloads on file change,
 * so we cache the instance on globalThis to avoid exhausting DB connections.
 */
const globalForPrisma = globalThis

// Postgres compute (Neon, and any serverless provider) suspends when idle, so
// the first query after a pause can fail with a transient connection error.
// These codes all mean "the socket was not ready", not "the data is wrong".
const TRANSIENT_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017'])
const TRANSIENT_MESSAGE_PATTERNS = [
  /Timed out fetching a new connection from the connection pool/i,
  /connection pool timeout/i,
  /Can't reach database server/i,
]

const RETRY_ATTEMPTS = 5
const RETRY_BASE_DELAY_MS = 250

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function isTransientDatabaseError(error) {
  if (TRANSIENT_CODES.has(error?.code)) return true

  const message = String(error?.message || '')
  return TRANSIENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
}

/**
 * Marks the statements that belong to an open interactive transaction.
 * Replaying one of those after a failure is what produces
 * "Transaction not found ... obtained before disconnecting", so the retry
 * hook below must stay out of the way inside a transaction.
 */
const txScope = new AsyncLocalStorage()

function createClient() {
  const base = new PrismaClient({
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
  })

  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        if (txScope.getStore()) return query(args)

        let lastError

        for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
          try {
            return await query(args)
          } catch (error) {
            if (!isTransientDatabaseError(error)) throw error
            lastError = error
            if (attempt < RETRY_ATTEMPTS - 1) {
              await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt)
            }
          }
        }

        throw lastError
      },
    },
  })
}

export const prisma = globalForPrisma.__colbertPrisma ?? createClient()

if (!env.isProduction) {
  globalForPrisma.__colbertPrisma = prisma
}

/**
 * Runs an interactive transaction with a budget that survives a slow Postgres.
 * Prisma's 5s default closes the transaction mid-way under load, which surfaces
 * as "Transaction not found ... obtained before disconnecting" on the next query.
 * The statements inside are never retried, because a failed statement has
 * already killed the transaction.
 */
const TX_TIMEOUT_MS = 30000
const TX_MAX_WAIT_MS = 20000

/**
 * A transaction that never started (or was rolled back) leaves no trace, so it
 * is safe to open it again. Neon can refuse to hand out a pooled connection
 * while its compute wakes up, which surfaces as P2028 / "Unable to start a
 * transaction in the given time" before the callback ever runs.
 */
const TX_START_CODES = new Set([...TRANSIENT_CODES, 'P2028', 'P2034'])
const TX_RETRY_ATTEMPTS = 3

export async function runTransaction(fn, options) {
  let lastError

  for (let attempt = 0; attempt < TX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => txScope.run(true, () => fn(tx)), {
        timeout: TX_TIMEOUT_MS,
        maxWait: TX_MAX_WAIT_MS,
        ...options,
      })
    } catch (error) {
      if (!TX_START_CODES.has(error?.code) && !/Unable to start a transaction/i.test(error?.message ?? '') && !isTransientDatabaseError(error)) {
        throw error
      }
      lastError = error
      if (attempt < TX_RETRY_ATTEMPTS - 1) {
        await sleep(500 * 2 ** attempt)
      }
    }
  }

  throw lastError
}

/**
 * A suspended compute makes whoever asks first pay for the wake-up, which on a
 * cold start is the unlucky client filling in the sign-up form. Opening the
 * connection at boot moves that cost to the deploy instead. The wake-up budget
 * is generous because there is no user waiting on it.
 */
const WARMUP_ATTEMPTS = 6
const WARMUP_BUDGET_MS = 60_000

export async function warmDatabase() {
  const startedAt = Date.now()

  for (let attempt = 0; attempt < WARMUP_ATTEMPTS; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`
      logger.info(`database ready in ${Date.now() - startedAt}ms`)
      return true
    } catch (error) {
      const spent = Date.now() - startedAt
      if (spent > WARMUP_BUDGET_MS) {
        logger.error({ err: error }, 'database unreachable at boot; requests will retry')
        return false
      }
      logger.warn(`database not ready yet (${error?.code ?? error?.message}); retrying`)
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt)
    }
  }

  logger.error('database still unreachable after warm-up attempts')
  return false
}
