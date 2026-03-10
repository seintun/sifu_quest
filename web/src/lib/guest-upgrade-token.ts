import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'
import { getAuthSecret } from './env'

type GuestUpgradeTokenPayload = {
  guestUserId: string
  exp: number
}

const MAX_TOKEN_AGE_SECONDS = 10 * 60

function encodeBase64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function decodeBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sign(data: string): string {
  return createHmac('sha256', getAuthSecret()).update(data).digest('base64url')
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function createGuestUpgradeToken(guestUserId: string): string {
  if (!isUuid(guestUserId)) {
    throw new Error('Invalid guest user id for upgrade token.')
  }

  const payload: GuestUpgradeTokenPayload = {
    guestUserId,
    exp: Math.floor(Date.now() / 1000) + MAX_TOKEN_AGE_SECONDS,
  }

  const encodedPayload = encodeBase64Url(JSON.stringify(payload))
  const signature = sign(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export function verifyGuestUpgradeToken(token: string): GuestUpgradeTokenPayload | null {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) {
    return null
  }

  const expectedSignature = sign(encodedPayload)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as GuestUpgradeTokenPayload
    if (!payload?.guestUserId || !payload?.exp) {
      return null
    }
    if (!isUuid(payload.guestUserId)) {
      return null
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    return payload
  } catch {
    return null
  }
}
