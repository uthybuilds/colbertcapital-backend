import { prisma } from '../../config/prisma.js'
import { publicPaymentMethod } from '../../lib/serialize.js'

/** Lists every active funding method clients can send money to. */
export async function listFundingMethods() {
  const methods = await prisma.paymentMethod.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { sortOrder: 'asc' },
  })

  return methods.map(publicPaymentMethod)
}
