import { createAdminClient } from './supabase-admin'

export async function logProgressEvent(
  userId: string,
  eventType: string,
  domain: string,
  payload: Record<string, unknown> = {}
) {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('progress_events').insert({
      user_id: userId,
      event_type: eventType,
      domain,
      payload
    })
    if (error) {
      console.error('Failed to log progress event', error)
    }
  } catch (error) {
    console.error('Failed to log progress event', error)
  }
}

export async function logAuditEvent(
  userId: string,
  action: string,
  resource: string,
  details: Record<string, unknown> = {}
) {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('audit_log').insert({
      user_id: userId,
      action,
      resource,
      details
    })
    if (error) {
      console.error('Failed to log audit event', error)
    }
  } catch (error) {
    console.error('Failed to log audit event', error)
  }
}
