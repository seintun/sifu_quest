// AES-256-GCM encrypted localStorage for chat history.
// The encryption key is derived server-side from the API key and held
// only in memory — it is never written to the browser's storage.

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Module-level singleton — fetched once per page load
let _cryptoKey: CryptoKey | null = null
let _keyPromise: Promise<CryptoKey> | null = null

async function getCryptoKey(): Promise<CryptoKey> {
  if (_cryptoKey) return _cryptoKey
  if (!_keyPromise) {
    _keyPromise = fetch('/api/encrypt-key')
      .then(r => r.json())
      .then(async ({ key }: { key: string }) => {
        const bytes = new Uint8Array(32)
        for (let i = 0; i < 32; i++) {
          bytes[i] = parseInt(key.slice(i * 2, i * 2 + 2), 16)
        }
        _cryptoKey = await crypto.subtle.importKey(
          'raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
        )
        return _cryptoKey
      })
  }
  return _keyPromise
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getCryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  )
  const combined = new Uint8Array(12 + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), 12)
  return toBase64(combined)
}

async function decrypt(data: string): Promise<string> {
  const key = await getCryptoKey()
  const combined = fromBase64(data)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: combined.slice(0, 12) },
    key,
    combined.slice(12)
  )
  return new TextDecoder().decode(plaintext)
}

export async function saveMessages(storageKey: string, messages: ChatMessage[]): Promise<void> {
  const encrypted = await encrypt(JSON.stringify(messages))
  localStorage.setItem(storageKey, encrypted)
}

export async function loadMessages(storageKey: string): Promise<ChatMessage[]> {
  const stored = localStorage.getItem(storageKey)
  if (!stored) return []
  try {
    const decrypted = await decrypt(stored)
    return JSON.parse(decrypted)
  } catch {
    // Fallback: legacy plaintext data — migrate it then clear
    try {
      const legacy = JSON.parse(stored)
      localStorage.removeItem(storageKey)
      return Array.isArray(legacy) ? legacy : []
    } catch {
      localStorage.removeItem(storageKey)
      return []
    }
  }
}

export function removeMessages(storageKey: string): void {
  localStorage.removeItem(storageKey)
}
