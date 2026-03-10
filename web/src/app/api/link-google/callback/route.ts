import { createClient } from '@/lib/supabase'
import { createAdminClient } from '@/lib/supabase-admin'
import { buildLinkedProfileUpdate } from '@/lib/link-google'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Failed to exchange code for session during identity link', error)
      return NextResponse.redirect(`${origin}/settings?error=link_failed`)
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      console.error('Identity link succeeded but user resolution failed', userError)
      return NextResponse.redirect(`${origin}/settings?error=link_failed`)
    }

    const linkedUser = userData.user
    const updatePayload = buildLinkedProfileUpdate(linkedUser.user_metadata)

    const supabaseAdmin = createAdminClient()
    const { error: profileUpdateError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({ id: linkedUser.id, ...updatePayload }, { onConflict: 'id' })

    if (profileUpdateError) {
      console.error('Linked identity but failed to finalize account state', profileUpdateError)
      return NextResponse.redirect(`${origin}/settings?error=link_failed`)
    }

    return NextResponse.redirect(`${origin}/settings?success=linked`)
  }

  // No code present
  return NextResponse.redirect(`${origin}/settings`)
}
