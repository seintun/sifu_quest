import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userId = session.user.id
    
    // We need the service role key to delete a user from auth.users
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY for GDPR delete")
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    
    // Initialize admin client
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    )
    
    // 1. Log the deletion in audit_log before deleting
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      action: 'user.delete',
      resource: 'account'
    })
    
    // 2. Delete the user_profile (cascades or is cascaded by auth.users)
    await supabaseAdmin.from('user_profiles').delete().eq('id', userId)
    
    // 3. Delete from auth.users (this should cascade to all other tables due to foreign keys)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (error) {
      console.error("Failed to delete user from Supabase auth:", error)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, message: 'Account deleted successfully' })
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
