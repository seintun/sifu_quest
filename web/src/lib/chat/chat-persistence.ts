import {
  isMissingMessageTelemetryColumnError,
  isMissingSessionTelemetryColumnError,
  isMissingSessionUsageRpcError,
} from '@/lib/chat-schema-compat'
import { estimateCostMicrousd, type TokenUsage } from '@/lib/chat-usage'
import type { ChatProvider } from '@/lib/chat-provider-config'
import { incrementFreeUserMessagesUsed } from '@/lib/free-quota'
import { createAdminClient } from '@/lib/supabase-admin'

export type PersistTurnInput = {
  supabase: ReturnType<typeof createAdminClient>
  sessionId: string
  userId: string
  userContent: string
  assistantContent: string
  provider: ChatProvider
  model: string
  usage: TokenUsage
  latencyMs: number
  estimatedCostMicrousd: number | null
  requestId: string | null
  enforceQuota: boolean
}

export function isMissingRpcFunctionError(
  error: { code?: string; message?: string } | null | undefined,
  functionName: string,
): boolean {
  if (!error) return false
  return error.code === 'PGRST202' || Boolean(error.message?.includes(functionName)) || Boolean(error.message?.includes('Could not find the function'))
}

async function persistChatTurnLegacy(input: PersistTurnInput): Promise<void> {
  const {
    supabase,
    sessionId,
    userId,
    userContent,
    assistantContent,
    provider,
    model,
    usage,
    latencyMs,
    estimatedCostMicrousd,
    requestId,
    enforceQuota,
  } = input

  const { data: ownedSession } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!ownedSession) {
    return
  }

  const { error: userInsertError } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    user_id: userId,
    role: 'user',
    content: userContent,
    provider,
    model,
  })
  if (userInsertError) {
    if (!isMissingMessageTelemetryColumnError(userInsertError)) {
      console.error('Failed to persist user chat message', userInsertError)
    }
    return
  }

  const { error: assistantInsertError } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    user_id: userId,
    role: 'assistant',
    content: assistantContent,
    provider,
    model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    total_tokens: usage.totalTokens,
    tokens_used: usage.totalTokens,
    latency_ms: latencyMs,
    estimated_cost_microusd: estimatedCostMicrousd,
    request_id: requestId,
  })
  if (assistantInsertError) {
    if (!isMissingMessageTelemetryColumnError(assistantInsertError)) {
      console.error('Failed to persist assistant chat message', assistantInsertError)
    }
    return
  }

  const { error: incrementSessionMessagesError } = await supabase.rpc('increment_session_messages', {
    session_id_param: sessionId,
    increment_by: 2,
  })
  if (incrementSessionMessagesError && !isMissingSessionTelemetryColumnError(incrementSessionMessagesError)) {
    console.error('Failed to increment session messages via RPC', incrementSessionMessagesError)
  }

  const { error: incrementChatSessionUsageError } = await supabase.rpc('increment_chat_session_usage', {
    session_id_param: sessionId,
    provider_param: provider,
    model_param: model,
    user_turn_increment: 1,
    input_tokens_increment: usage.inputTokens ?? 0,
    output_tokens_increment: usage.outputTokens ?? 0,
    total_tokens_increment: usage.totalTokens ?? 0,
    cost_increment: estimatedCostMicrousd ?? 0,
  })
  if (incrementChatSessionUsageError && !isMissingSessionUsageRpcError(incrementChatSessionUsageError)) {
    console.error('Failed to increment chat session usage via RPC', incrementChatSessionUsageError)
  }

  const { data: currentDefaults, error: profileDefaultsError } = await supabase
    .from('user_profiles')
    .select('default_provider, default_model')
    .eq('id', userId)
    .maybeSingle()

  if (profileDefaultsError) {
    console.warn('Unable to load current default provider/model on profile', profileDefaultsError)
  } else {
    const shouldUpdateDefaults = currentDefaults?.default_provider !== provider || currentDefaults?.default_model !== model

    if (shouldUpdateDefaults) {
      const { error: profileUpdateError } = await supabase
        .from('user_profiles')
        .update({
          default_provider: provider,
          default_model: model,
        })
        .eq('id', userId)
      if (profileUpdateError) {
        console.warn('Unable to persist default provider/model on profile', profileUpdateError)
      }
    }
  }

  if (enforceQuota) {
    try {
      await incrementFreeUserMessagesUsed(userId, 1)
    } catch (quotaError) {
      console.error('Failed to increment free quota usage', quotaError)
    }
  }
}

export async function persistChatTurn(input: PersistTurnInput): Promise<void> {
  const {
    supabase,
    sessionId,
    userId,
    userContent,
    assistantContent,
    provider,
    model,
    usage,
    latencyMs,
    estimatedCostMicrousd,
    requestId,
    enforceQuota,
  } = input

  const { data, error } = await supabase.rpc('persist_chat_turn', {
    session_id_param: sessionId,
    user_id_param: userId,
    user_content_param: userContent,
    assistant_content_param: assistantContent,
    provider_param: provider,
    model_param: model,
    input_tokens_param: usage.inputTokens ?? 0,
    output_tokens_param: usage.outputTokens ?? 0,
    total_tokens_param: usage.totalTokens ?? 0,
    latency_ms_param: latencyMs,
    estimated_cost_param: estimatedCostMicrousd ?? 0,
    request_id_param: requestId,
  })

  if (error) {
    if (isMissingRpcFunctionError(error, 'persist_chat_turn')) {
      await persistChatTurnLegacy(input)
      return
    }
    throw new Error(error.message)
  }

  if (!data) {
    return
  }

  if (enforceQuota) {
    try {
      await incrementFreeUserMessagesUsed(userId, 1)
    } catch (quotaError) {
      console.error('Failed to increment free quota usage', quotaError)
    }
  }
}

export function resolveCostMicrousd(
  provider: ChatProvider,
  model: string,
  usage: TokenUsage,
  providerReportedCostMicrousd: number | null,
): number | null {
  return providerReportedCostMicrousd ?? estimateCostMicrousd(provider, model, usage)
}
