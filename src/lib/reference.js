/**
 * Human readable references backed by the `counters` table.
 * Must be called inside a transaction so the value cannot be handed out twice.
 */
export function formatReference(prefix, value) {
  return `${prefix}-${String(value).padStart(4, '0')}`
}

export async function nextReference(tx, key, prefix) {
  const record = await tx.counter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  })
  return formatReference(prefix, record.value)
}
