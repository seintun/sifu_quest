import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// Use a fallback for local dev if the secret isn't in .env yet, 
// but ensure it's a 32-byte hex string.
const getSecret = () => {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('API_KEY_ENCRYPTION_SECRET is not set')
    }
    // Return a dummy 32-byte hex string for local dev if missing
    return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  }
  return secret
}

export function encryptKey(apiKey: string): string {
  const secret = getSecret()
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(secret, 'hex'), iv)
  
  const encrypted = cipher.update(apiKey, 'utf8', 'hex') + cipher.final('hex')
  return `${iv.toString('hex')}:${encrypted}`
}

export function decryptKey(encryptedString: string): string | null {
  try {
    const secret = getSecret()
    const [ivHex, encryptedData] = encryptedString.split(':')
    
    if (!ivHex || !encryptedData) {
      return null
    }

    const decipher = createDecipheriv(
      'aes-256-cbc', 
      Buffer.from(secret, 'hex'), 
      Buffer.from(ivHex, 'hex')
    )
    
    return decipher.update(encryptedData, 'hex', 'utf8') + decipher.final('utf8')
  } catch (err) {
    console.error('Failed to decrypt API key', err)
    return null
  }
}
