import { prisma } from '../config/prisma.js'
import { logger } from '../config/logger.js'

/**
 * Append-only trail for privileged actions. Never throws into the request
 * path — a failed audit write is logged, not surfaced to the caller.
 */
export async function recordAudit({
  actorId,
  actorRole,
  action,
  entity,
  entityId,
  metadata,
  ipAddress,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        actorRole: actorRole ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        metadata: metadata ?? undefined,
        ipAddress: ipAddress ?? null,
      },
    })
  } catch (error) {
    logger.error({ err: error, action, entity, entityId }, 'audit write failed')
  }
}
