/**
 * Address minimisation.
 *
 * A full client address is personal data, and the audit trail we keep only ever
 * needs to tell "same network" from "somewhere else". So we store the network
 * prefix and drop the host part: IPv4 keeps its /24, IPv6 its /48. Anything we
 * cannot parse is discarded rather than stored raw.
 */
export function maskIp(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  // "[::1]:443", "::1%lo0" and friends -> the address on its own.
  const bare = raw.replace(/^\[|\]$/g, '').split('%')[0].split(']')[0]

  const v4 = bare.replace(/^::ffff:/i, '')
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) {
    return `${v4.split('.').slice(0, 3).join('.')}.0`
  }

  if (bare.includes(':')) {
    const hextets = bare.split(':').filter(Boolean)
    return hextets.length >= 3 ? `${hextets.slice(0, 3).join(':')}::` : '::'
  }

  return null
}

/** Extracts the caller metadata we persist for security auditing. */
export function requestMeta(req) {
  return {
    ipAddress: maskIp(req.ip || req.socket?.remoteAddress),
    userAgent: req.get?.('user-agent') || null,
  }
}
