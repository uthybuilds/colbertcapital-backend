const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export function parsePagination(query, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const requested = Number.parseInt(query.limit, 10) || defaultLimit
  const limit = Math.min(Math.max(1, requested), maxLimit)
  return { page, limit, skip: (page - 1) * limit, take: limit }
}

export function buildMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  }
}
