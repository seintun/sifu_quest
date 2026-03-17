import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { getApiKeyEncryptionSecret } from './env'

const getSecret = () => getApiKeyEncryptionSecret()

// GCM tag length in bytes
const GCM_TAG_LENGTH = 16
// GCM IV length in bytes (recommended 12)
const GCM_IV_LENGTH = 12

/**
 * Format version prefix for distinguishing encryption schemes:
 * "gcm:" = AES-256-GCM (current, authenticated)
 * (no prefix) = AES-256-CBC (legacy, still supported for decryption)
 */
const GCM_PREFIX = 'gcm:'

export function encryptKey(apiKey: string): string {
  const secret = getSecret()
  const iv = randomBytes(GCM_IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), iv)

  const encrypted = cipher.update(apiKey, 'utf8', 'hex') + cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  // Format: gcm:ivHex:encryptedHex:authTagHex
  return `${GCM_PREFIX}${iv.toString('hex')}:${encrypted}:${authTag}`
}

export function decryptKey(encryptedString: string): string | null {
  try {
    const secret = getSecret()

    // Check for GCM format (has "gcm:" prefix)
    if (encryptedString.startsWith(GCM_PREFIX)) {
      return decryptGcm(secret, encryptedString.slice(GCM_PREFIX.length))
    }

    // Fall back to legacy CBC format for existing keys
    return decryptLegacyCbc(secret, encryptedString)
  } catch (err) {
    console.error('Failed to decrypt API key', err)
    return null
  }
}

function decryptGcm(secret: string, payload: string): string | null {
  const parts = payload.split(':')
  if (parts.length !== 3) {
    return null
  }

  const [ivHex, encryptedData, authTagHex] = parts
  if (!ivHex || !encryptedData || !authTagHex) {
    return null
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(secret, 'hex'),
    Buffer.from(ivHex, 'hex'),
  )
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))

  return decipher.update(encryptedData, 'hex', 'utf8') + decipher.final('utf8')
}

function decryptLegacyCbc(secret: string, encryptedString: string): string | null {
  const [ivHex, encryptedData] = encryptedString.split(':')

  if (!ivHex || !encryptedData) {
    return null
  }

  const decipher = createDecipheriv(
    'aes-256-cbc',
    Buffer.from(secret, 'hex'),
    Buffer.from(ivHex, 'hex'),
  )

  return decipher.update(encryptedData, 'hex', 'utf8') + decipher.final('utf8')
}
