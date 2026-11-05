import { env } from '../../config/env.js'
import { prisma, runTransaction } from '../../config/prisma.js'
import { ApiError } from '../../lib/ApiError.js'
import { nextReference } from '../../lib/reference.js'
import { publicThread } from '../../lib/serialize.js'
import { sendMailSafe } from '../../mail/mailer.js'
import { renderSupportTicketNotification } from '../../mail/templates.js'

const withMessages = { messages: { orderBy: { createdAt: 'asc' } } }

/** A thread belongs to the client when it is tied to their id, or (legacy) their email. */
const ownedBy = (user) => ({ OR: [{ userId: user.id }, { email: user.email }] })

/** Tells the operations inbox that a ticket was opened or answered. */
async function notifyOperations({ thread, latestBody, isReply }) {
  const { subject, html } = renderSupportTicketNotification({ thread, latestBody, isReply })
  await sendMailSafe({
    to: env.MAIL_INQUIRIES_TO,
    subject,
    html,
    replyTo: thread.email || undefined,
  })
}

export async function listMyThreads({ user }) {
  const threads = await prisma.supportThread.findMany({
    where: ownedBy(user),
    orderBy: { updatedAt: 'desc' },
    include: withMessages,
  })

  return threads.map(publicThread)
}

export async function getMyThread({ user, id }) {
  const thread = await prisma.supportThread.findFirst({
    where: { id, ...ownedBy(user) },
    include: withMessages,
  })

  if (!thread) throw ApiError.notFound('That support ticket could not be found.')

  return publicThread(thread)
}

export async function createThread({ user, input }) {
  const thread = await runTransaction(async (tx) => {
    const reference = await nextReference(tx, 'support', 'TKT')

    return tx.supportThread.create({
      data: {
        reference,
        userId: user.id,
        email: user.email,
        clientName: `${user.firstName} ${user.lastName}`,
        subject: input.subject,
        topic: input.topic,
        priority: input.priority || 'NORMAL',
        status: 'OPEN',
        messages: {
          create: {
            authorRole: 'CLIENT',
            authorId: user.id,
            body: input.body,
          },
        },
      },
      include: withMessages,
    })
  })

  await notifyOperations({ thread, latestBody: input.body, isReply: false })

  return publicThread(thread)
}

export async function replyToThread({ user, id, input }) {
  const existing = await prisma.supportThread.findFirst({
    where: { id, ...ownedBy(user) },
  })

  if (!existing) throw ApiError.notFound('That support ticket could not be found.')

  const thread = await runTransaction(async (tx) => {
    await tx.supportMessage.create({
      data: {
        threadId: existing.id,
        authorRole: 'CLIENT',
        authorId: user.id,
        body: input.body,
      },
    })

    // A client reply always reopens the ticket.
    return tx.supportThread.update({
      where: { id: existing.id },
      data: { status: 'OPEN', updatedAt: new Date() },
      include: withMessages,
    })
  })

  await notifyOperations({ thread, latestBody: input.body, isReply: true })

  return publicThread(thread)
}
