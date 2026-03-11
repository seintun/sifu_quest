type DbErrorLike = {
  code?: string | null
  message?: string | null
}

const SESSION_TELEMETRY_MARKERS = [
  'chat_sessions.provider',
  'chat_sessions.model',
  'chat_sessions.user_turns_count',
  'chat_sessions.input_tokens_total',
  'chat_sessions.output_tokens_total',
  'chat_sessions.total_tokens_total',
  'chat_sessions.estimated_cost_microusd_total',
  "'provider' column of 'chat_sessions'",
  "'model' column of 'chat_sessions'",
  "'user_turns_count' column of 'chat_sessions'",
  "'input_tokens_total' column of 'chat_sessions'",
  "'output_tokens_total' column of 'chat_sessions'",
  "'total_tokens_total' column of 'chat_sessions'",
  "'estimated_cost_microusd_total' column of 'chat_sessions'",
]

const MESSAGE_TELEMETRY_MARKERS = [
  'chat_messages.provider',
  'chat_messages.model',
  'chat_messages.input_tokens',
  'chat_messages.output_tokens',
  'chat_messages.total_tokens',
  'chat_messages.latency_ms',
  'chat_messages.estimated_cost_microusd',
  'chat_messages.request_id',
  "'provider' column of 'chat_messages'",
  "'model' column of 'chat_messages'",
  "'input_tokens' column of 'chat_messages'",
  "'output_tokens' column of 'chat_messages'",
  "'total_tokens' column of 'chat_messages'",
  "'latency_ms' column of 'chat_messages'",
  "'estimated_cost_microusd' column of 'chat_messages'",
  "'request_id' column of 'chat_messages'",
]

function hasMarker(message: string | undefined | null, markers: string[]): boolean {
  const normalized = (message ?? '').toLowerCase()
  return markers.some((marker) => normalized.includes(marker.toLowerCase()))
}

export function isMissingSessionTelemetryColumnError(error: DbErrorLike | null | undefined): boolean {
  if (!error) {
    return false
  }

  const isMissingColumnError = error.code === '42703' || error.code === 'PGRST204'
  if (!isMissingColumnError) {
    return false
  }

  return hasMarker(error.message, SESSION_TELEMETRY_MARKERS)
}

export function isMissingMessageTelemetryColumnError(error: DbErrorLike | null | undefined): boolean {
  if (!error) {
    return false
  }

  const isMissingColumnError = error.code === '42703' || error.code === 'PGRST204'
  if (!isMissingColumnError) {
    return false
  }

  return hasMarker(error.message, MESSAGE_TELEMETRY_MARKERS)
}

export function isMissingSessionUsageRpcError(error: DbErrorLike | null | undefined): boolean {
  if (!error) {
    return false
  }

  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    Boolean(error.message?.includes('increment_chat_session_usage'))
  )
}

export function isMissingAccountUsageRpcError(error: DbErrorLike | null | undefined): boolean {
  if (!error) {
    return false
  }

  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    Boolean(error.message?.includes('get_account_usage_aggregates'))
  )
}
