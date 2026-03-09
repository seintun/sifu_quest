import { createClient } from './supabase'

export async function logProgressEvent(
  userId: string,
  eventType: string,
  domain: string,
  payload: Record<string, any> = {}
) {
  try {
    const supabase = await createClient()
    await supabase.from('progress_events').insert({
      user_id: userId,
      event_type: eventType,
      domain,
      payload
    })
  } catch (error) {
    console.error('Failed to log progress event', error)
  }
}

export async function logAuditEvent(
  userId: string,
  action: string,
  resource: string,
  details: Record<string, any> = {}
) {
  try {
    const supabase = await createClient()
    await supabase.from('audit_log').insert({
      user_id: userId,
      action,
      resource,
      details
    })
  } catch (error) {
    console.error('Failed to log audit event', error)
  }
}
