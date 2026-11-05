import { env } from '../../config/env.js'
import { logger } from '../../config/logger.js'
import { prisma } from '../../config/prisma.js'
import { requestMeta } from '../../lib/request.js'
import { sendMail } from '../../mail/mailer.js'
import { renderInquiryAutoReply, renderInquiryNotification } from '../../mail/templates.js'

export async function submitInquiry({ input, req }) {
  const meta = requestMeta(req)

  const inquiry = await prisma.inquiry.create({
    data: {
      name: input.name,
      email: input.email,
      company: input.company,
      inquiryType: input.inquiryType,
      region: input.region,
      message: input.message,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  })

  // The inquiry is persisted first — a mail failure must not fail the request.
  try {
    const { subject, html } = renderInquiryNotification({ inquiry })
    await sendMail({ to: env.MAIL_INQUIRIES_TO, subject, html, replyTo: inquiry.email })
  } catch (error) {
    logger.warn({ err: error, inquiryId: inquiry.id }, 'inquiry notification email failed')
  }

  try {
    const { subject, html } = renderInquiryAutoReply({ name: inquiry.name })
    await sendMail({ to: inquiry.email, subject, html })
  } catch (error) {
    logger.warn({ err: error, inquiryId: inquiry.id }, 'inquiry auto-reply email failed')
  }

  return { message: 'Thank you. Your inquiry has reached the right team.' }
}
