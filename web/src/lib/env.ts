const INFRA_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SIFU_ANTHROPIC_API_KEY',
  'SIFU_OPENROUTER_API_KEY',
  'API_KEY_ENCRYPTION_SECRET',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
] as const

export type InfraEnvKey = (typeof INFRA_ENV_KEYS)[number]

export class MissingEnvironmentVariableError extends Error {
  missingKeys: string[]

  constructor(missingKeys: string[]) {
    super(`Server configuration is incomplete. Missing keys: ${missingKeys.join(', ')}`)
    this.name = 'MissingEnvironmentVariableError'
    this.missingKeys = missingKeys
  }
}

export function getMissingRequiredEnv(keys: readonly string[]): string[] {
  return keys.filter((key) => {
    // Vercel sets `VERCEL=1` automatically.
    // If we're on Vercel, NextAuth strictly infers the callback base URL from VERCEL_URL, 
    // so we don't *need* NEXTAUTH_URL defined in the Vercel dashboard for Preview environments.
    if (key === 'NEXTAUTH_URL' && process.env.VERCEL === '1') {
      return false
    }
    
    return !process.env[key] || process.env[key]?.trim().length === 0
  })
}

export function assertRequiredEnv(keys: readonly string[]): void {
  const missing = getMissingRequiredEnv(keys)
  if (missing.length > 0) {
    throw new MissingEnvironmentVariableError(missing)
  }
}

export function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  if (!secret || secret.trim().length === 0) {
    throw new Error('Missing NEXTAUTH_SECRET (AUTH_SECRET fallback is supported but deprecated).')
  }
  return secret
}

export function getApiKeyEncryptionSecret(): string {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET
  if (!secret) {
    throw new Error('Missing API_KEY_ENCRYPTION_SECRET')
  }
  if (!/^[0-9a-fA-F]{64}$/.test(secret)) {
    throw new Error('API_KEY_ENCRYPTION_SECRET must be a 32-byte hex string (64 hex chars).')
  }
  return secret
}

export function getRuntimeConfigStatus() {
  const required = INFRA_ENV_KEYS.map((key) => ({
    key,
    configured: Boolean(process.env[key] && process.env[key]!.trim().length > 0),
  }))

  const optional = [
    'NEXT_PUBLIC_SENTRY_DSN',
    'SENTRY_ORG',
    'SENTRY_PROJECT',
    'SENTRY_TRACES_SAMPLE_RATE',
    'NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE',
  ].map((key) => ({
    key,
    configured: Boolean(process.env[key] && process.env[key]!.trim().length > 0),
  }))

  return {
    required,
    optional,
    missingRequiredKeys: required.filter((item) => !item.configured).map((item) => item.key),
  }
}
