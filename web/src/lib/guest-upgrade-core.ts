export function getGuestUpgradeRedirectUrl(origin: string): string {
  return `${origin}/api/link-google/callback`
}

type LinkIdentityFn = (args: {
  provider: 'google'
  options: { redirectTo: string }
}) => Promise<{ error: { message: string } | null }>

export async function runGuestGoogleLink(linkIdentity: LinkIdentityFn, origin: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await linkIdentity({
    provider: 'google',
    options: {
      redirectTo: getGuestUpgradeRedirectUrl(origin),
    },
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
