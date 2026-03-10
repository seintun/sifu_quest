import { createAdminClient } from '@/lib/supabase-admin'
import { readMemoryFile, writeMemoryFile } from '@/lib/memory'
import { updateProfileNameInMarkdown, validateFullName } from '@/lib/profile-name'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { fullName?: unknown }
    const fullNameRaw = typeof body.fullName === 'string' ? body.fullName : ''
    const validated = validateFullName(fullNameRaw)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const supabaseAdmin = createAdminClient()

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          display_name: validated.value,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )

    if (profileError) {
      console.error('Failed to update display_name in profile', profileError)
      return NextResponse.json({ error: 'Unable to update your full name right now. Please try again.' }, { status: 500 })
    }

    const currentProfileMarkdown = await readMemoryFile(userId, 'profile.md')
    const updatedProfileMarkdown = updateProfileNameInMarkdown(currentProfileMarkdown, validated.value)
    await writeMemoryFile(userId, 'profile.md', updatedProfileMarkdown, 'settings_profile')

    const { error: auditError } = await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      action: 'account.name.update',
      resource: 'user_profiles',
      details: { display_name: validated.value },
    })
    if (auditError) {
      console.warn('Failed to write audit event for display_name update', auditError)
    }

    return NextResponse.json({
      success: true,
      account: {
        displayName: validated.value,
      },
    })
  } catch (error) {
    console.error('Failed to update account profile', error)
    return NextResponse.json(
      { error: 'Unable to update your full name right now. Please try again.' },
      { status: 500 },
    )
  }
}

export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const supabaseAdmin = createAdminClient()
    
    // 1. Log the deletion in audit_log before deleting
    const { error: auditError } = await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      action: 'user.delete',
      resource: 'account'
    })
    if (auditError) {
      console.warn('Failed to write audit event before account deletion', auditError)
    }
    
    // 2. Delete the user_profile (cascades or is cascaded by auth.users)
    const { error: deleteProfileError } = await supabaseAdmin.from('user_profiles').delete().eq('id', userId)
    if (deleteProfileError) {
      console.warn('Failed to delete user profile before auth deletion', deleteProfileError)
    }
    
    // 3. Delete from auth.users (this should cascade to all other tables due to foreign keys)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (error) {
      console.error("Failed to delete user from Supabase auth:", error)
      const status = typeof (error as { status?: unknown }).status === 'number'
        ? (error as { status: number }).status
        : undefined
      if (status === 404) {
        return NextResponse.json(
          { error: 'Session identity is out of sync. Please sign out and sign in again.', code: 'identity_mismatch' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, message: 'Account deleted successfully' })
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
