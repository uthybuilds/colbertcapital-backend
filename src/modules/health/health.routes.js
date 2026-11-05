import { Router } from 'express'
import { prisma } from '../../config/prisma.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

const router = Router()

/** Liveness — the process is up. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({
      data: {
        status: 'ok',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    })
  }),
)

/** Readiness — dependency checks. */
router.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`
    res.json({ data: { status: 'ready', database: 'connected' } })
  }),
)

export default router
