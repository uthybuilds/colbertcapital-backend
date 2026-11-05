import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { prisma, warmDatabase } from './config/prisma.js'

const app = createApp()

const server = app.listen(env.PORT, () => {
  logger.info(
    `Colbert Capital API listening on http://localhost:${env.PORT}${env.API_PREFIX} [${env.NODE_ENV}]`,
  )
  // Fire and forget: the server takes traffic immediately, but by the time a
  // client reaches a form the database connection is already open.
  void warmDatabase()
})

let shuttingDown = false

async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true

  logger.info({ signal }, 'shutting down')

  server.close(async () => {
    await prisma.$disconnect()
    logger.info('shutdown complete')
    process.exit(0)
  })

  // Do not hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled promise rejection')
})

process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'uncaught exception')
  shutdown('uncaughtException')
})
