import { createClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

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
    
    // Identity successfully linked in Supabase!
    // At this point, the user's Supabase account has both the anonymous identity and the Google identity.
    return NextResponse.redirect(`${origin}/settings?success=linked`)
  }

  // No code present
  return NextResponse.redirect(`${origin}/settings`)
}
