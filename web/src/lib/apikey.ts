import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { getApiKeyEncryptionSecret } from './env'

const getSecret = () => getApiKeyEncryptionSecret()

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
