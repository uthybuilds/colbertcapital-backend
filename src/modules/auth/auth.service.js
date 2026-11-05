import { env } from '../../config/env.js'
import { prisma } from '../../config/prisma.js'
import { ApiError } from '../../lib/ApiError.js'
import { recordAudit } from '../../lib/audit.js'
import { generateOtp, matchesOtp, otpExpiry } from '../../lib/otp.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { requestMeta } from '../../lib/request.js'
import { publicUser } from '../../lib/serialize.js'
import { hashToken, issueRefreshToken, signAccessToken } from '../../lib/tokens.js'
import { assertHuman } from '../../lib/turnstile.js'
import { sendMail } from '../../mail/mailer.js'
import {
  renderLoginOtpEmail,
  renderResetPasswordEmail,
  renderVerificationEmail,
} from '../../mail/templates.js'

// ------------------------------------------------------------------ OTP core

/**
 * The desk's suspension note is written for the client to read, so it is shown
 * back to them instead of the generic message.
 */
const suspensionMessage = (user) =>
  user.suspensionNote
    ? `Your account is suspended: ${user.suspensionNote}`
    : 'Your account is suspended. Please contact client services for assistance.'

const OTP_TEMPLATES = {
  EMAIL_VERIFICATION: (user, code) =>
    renderVerificationEmail({
      firstName: user.firstName,
      code,
      expiresInMinutes: env.OTP_TTL_MINUTES,
    }),
  LOGIN: (user, code, meta) =>
    renderLoginOtpEmail({
      firstName: user.firstName,
      code,
      expiresInMinutes: env.OTP_TTL_MINUTES,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    }),
  RESET_PASSWORD: (user, code) =>
    renderResetPasswordEmail({
      firstName: user.firstName,
      code,
      expiresInMinutes: env.OTP_TTL_MINUTES,
    }),
}

async function assertResendAllowed(userId, purpose) {
  const latest = await prisma.otpCode.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: 'desc' },
  })
  if (!latest) return

  const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000
  const wait = env.OTP_RESEND_COOLDOWN_SECONDS - elapsed
  if (wait > 0) {
    throw new ApiError(
      429,
      'OTP_COOLDOWN',
      `Please wait ${Math.ceil(wait)} seconds before requesting another code.`,
    )
  }
}

/** Invalidates any live code for the purpose, then issues and emails a new one. */
async function issueOtp(user, purpose, meta = {}) {
  await assertResendAllowed(user.id, purpose)

  const { code, codeHash } = generateOtp()

  await prisma.$transaction([
    prisma.otpCode.updateMany({
      where: { userId: user.id, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.otpCode.create({
      data: { userId: user.id, purpose, codeHash, expiresAt: otpExpiry() },
    }),
  ])

  const { subject, html } = OTP_TEMPLATES[purpose](user, code, meta)
  await sendMail({ to: user.email, subject, html })

  return code
}

/** Validates a submitted code and burns it on success. */
async function consumeOtp(userId, purpose, code) {
  const record = await prisma.otpCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) {
    throw ApiError.badRequest('There is no active code for this request. Please ask for a new one.')
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest('That code has expired. Please request a new one.')
  }
  if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw ApiError.tooManyRequests('Too many incorrect attempts. Please request a new code.')
  }
  if (!matchesOtp(code, record.codeHash)) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    })
    throw ApiError.badRequest('That code is not correct.')
  }

  await prisma.otpCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  })
}

// ------------------------------------------------------------------ sessions

async function startSession(user, req) {
  const accessToken = signAccessToken(user)
  const { token, tokenHash, expiresAt } = issueRefreshToken()
  const meta = requestMeta(req)

  await prisma.$transaction([
    prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ])

  return { accessToken, refreshToken: token }
}

// ------------------------------------------------------------------- actions

export async function register({ input, req }) {
  await assertHuman(input.turnstileToken, req.ip)

  const existing = await prisma.user.findUnique({ where: { email: input.email } })

  if (existing?.emailVerifiedAt) {
    throw ApiError.conflict('An account with that email address already exists.')
  }

  let user = existing

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
        country: input.country || null,
        status: 'PENDING',
      },
    })
    await recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: 'user.register',
      entity: 'User',
      entityId: user.id,
      ...requestMeta(req),
    })
  }

  await issueOtp(user, 'EMAIL_VERIFICATION', requestMeta(req))

  return {
    user: publicUser(user),
    next: 'EMAIL_VERIFICATION',
    message: 'We sent a 6 digit code to your email address.',
  }
}

export async function verifyEmail({ input, req }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) throw ApiError.badRequest('We could not find that account.')

  await consumeOtp(user.id, 'EMAIL_VERIFICATION', input.code)

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
  })

  const tokens = await startSession(updated, req)

  return { user: publicUser(updated), ...tokens }
}

export async function resendOtp({ input, req }) {
  await assertHuman(input.turnstileToken, req.ip)

  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) throw ApiError.badRequest('We could not find that account.')
  if (user.status === 'SUSPENDED') throw ApiError.forbidden('This account is suspended.')

  // A verification code is pointless once the address is confirmed.
  if (input.purpose === 'EMAIL_VERIFICATION' && user.emailVerifiedAt) {
    throw ApiError.badRequest('This email address is already verified.')
  }

  await issueOtp(user, input.purpose)

  return { next: input.purpose, message: 'A new code is on its way.' }
}

export async function login({ input, req }) {
  await assertHuman(input.turnstileToken, req.ip)

  const user = await prisma.user.findUnique({ where: { email: input.email } })

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw ApiError.unauthorized('Email or password is incorrect.')
  }
  if (user.role !== 'USER') {
    throw ApiError.forbidden('Use the administrator sign-in page for this account.')
  }
  if (user.status === 'SUSPENDED') {
    throw ApiError.forbidden(suspensionMessage(user))
  }

  const meta = requestMeta(req)
  const account =
    !user.emailVerifiedAt || user.status === 'PENDING'
      ? await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
            status: 'ACTIVE',
          },
        })
      : user

  const tokens = await startSession(account, req)

  await recordAudit({
    actorId: account.id,
    actorRole: account.role,
    action: 'user.login',
    entity: 'User',
    entityId: account.id,
    ...meta,
  })

  return { user: publicUser(account), ...tokens }
}

export async function loginVerify({ input, req }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) throw ApiError.unauthorized('Email or password is incorrect.')
  if (user.role !== 'USER') {
    throw ApiError.forbidden('Use the administrator sign-in page for this account.')
  }
  if (user.status === 'SUSPENDED') {
    throw ApiError.forbidden(suspensionMessage(user))
  }

  await consumeOtp(user.id, 'LOGIN', input.code)
  const tokens = await startSession(user, req)

  return { user: publicUser(user), ...tokens }
}

export async function adminLogin({ input, req }) {
  await assertHuman(input.turnstileToken, req.ip)

  const user = await prisma.user.findUnique({ where: { email: input.email } })

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw ApiError.unauthorized('Email or password is incorrect.')
  }
  if (user.role !== 'ADMIN') {
    throw ApiError.forbidden('This account does not have administrator access.')
  }
  if (user.status === 'SUSPENDED') {
    throw ApiError.forbidden('This administrator account is suspended.')
  }

  const tokens = await startSession(user, req)

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: 'admin.login',
    entity: 'User',
    entityId: user.id,
    ...requestMeta(req),
  })

  return { user: publicUser(user), ...tokens }
}

export async function refresh({ input, req }) {
  const tokenHash = hashToken(input.refreshToken)

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.')
  }
  if (session.user.status === 'SUSPENDED') {
    throw ApiError.forbidden('Your account is suspended. Please contact client services.')
  }

  // Rotate: the presented token is retired immediately.
  const next = issueRefreshToken()
  const meta = requestMeta(req)

  await prisma.$transaction([
    prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    }),
    prisma.session.create({
      data: {
        userId: session.userId,
        tokenHash: next.tokenHash,
        expiresAt: next.expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    }),
  ])

  return {
    user: publicUser(session.user),
    accessToken: signAccessToken(session.user),
    refreshToken: next.token,
  }
}

export async function logout({ input, userId }) {
  if (input?.refreshToken) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(input.refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  } else if (userId) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  return { message: 'Signed out.' }
}

export async function forgotPassword({ input, req }) {
  await assertHuman(input.turnstileToken, req.ip)

  const user = await prisma.user.findUnique({ where: { email: input.email } })

  // Always answer the same way so the endpoint cannot be used to enumerate accounts.
  const generic = {
    message: 'If an account exists for that address, a reset code is on its way.',
  }

  if (!user || user.status === 'SUSPENDED') return generic

  await issueOtp(user, 'RESET_PASSWORD')
  return generic
}

export async function resetPassword({ input, req }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) throw ApiError.badRequest('We could not find that account.')

  await consumeOtp(user.id, 'RESET_PASSWORD', input.code)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(input.password),
        ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date(), status: 'ACTIVE' }),
      },
    }),
    // Any other live session is retired after a credential change.
    prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  await recordAudit({
    actorId: user.id,
    actorRole: user.role,
    action: 'user.password_reset',
    entity: 'User',
    entityId: user.id,
    ...requestMeta(req),
  })

  return { message: 'Your password has been updated. Please sign in.' }
}

export async function me({ user }) {
  return publicUser(user)
}
