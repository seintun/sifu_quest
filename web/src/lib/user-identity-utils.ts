export function shouldAttemptEmailFallback(sessionEmail?: string | null): boolean {
  return Boolean(sessionEmail && !sessionEmail.endsWith('@anonymous.local'))
}
