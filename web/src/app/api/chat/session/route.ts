import { auth } from '@/auth'
import { ensureUserProfile } from '@/lib/account-state'
import { DEFAULT_OPENROUTER_MODEL } from '@/lib/chat-provider-config'
import {
  isMissingMessageTelemetryColumnError,
  isMissingSessionTelemetryColumnError,
} from '@/lib/chat-schema-compat'
import { resolveProviderSelection } from '@/lib/chat-selection'
import { computeFreeQuota } from '@/lib/free-quota'
import { hasEncryptedProviderApiKey } from '@/lib/provider-api-keys'
import { createAdminClient } from '@/lib/supabase-admin'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
const CHAT_SESSION_UNAVAILABLE_MESSAGE = 'We could not load your chat right now. Please refresh and try again.'

const SESSION_SELECT_WITH_TELEMETRY = 'id, title, created_at, message_count, provider, model, user_turns_count, input_tokens_total, output_tokens_total, total_tokens_total, estimated_cost_microusd_total'
const SESSION_SELECT_LEGACY = 'id, title, created_at, message_count'
const MESSAGE_SELECT_WITH_TELEMETRY = 'id, role, content, created_at, provider, model, input_tokens, output_tokens, total_tokens, estimated_cost_microusd, latency_ms'
const MESSAGE_SELECT_LEGACY = 'id, role, content, created_at, tokens_used'

type SessionRow = {
  id: string
  title: string | null
  created_at: string
  message_count: number | null
  provider?: string | null
  model?: string | null
  user_turns_count?: number | null
  input_tokens_total?: number | null
  output_tokens_total?: number | null
  total_tokens_total?: number | null
  estimated_cost_microusd_total?: number | null
}

type MessageRow = {
  id: number | string
  role: string
  content: string
  created_at: string
  provider?: string | null
  model?: string | null
  input_tokens?: number | null
  output_tokens?: number | null
  total_tokens?: number | null
  estimated_cost_microusd?: number | null
  latency_ms?: number | null
  tokens_used?: number | null
}

function estimateLegacyUserTurns(messageCount: number | null | undefined): number {
  const totalMessages = messageCount ?? 0
  return totalMessages > 0 ? Math.floor(totalMessages / 2) : 0
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')
    const before = searchParams.get('before')
    const limitParam = searchParams.get('limit')
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : null
    const pageSize = Number.isFinite(parsedLimit) && parsedLimit && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : null

    if (!mode) {
      return NextResponse.json({ error: 'Mode is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const userProfile = await ensureUserProfile(userId, session.user.email)
    const hasAnthropicKey = await hasEncryptedProviderApiKey(userId, 'anthropic')
    const freeQuota = computeFreeQuota(userProfile)

    let chatSession: SessionRow | null = null
    let sessionTelemetryAvailable = true

    const modernSessionQuery = await supabase
      .from('chat_sessions')
      .select(SESSION_SELECT_WITH_TELEMETRY)
      .eq('user_id', userId)
      .eq('mode', mode)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!modernSessionQuery.error || modernSessionQuery.error.code === 'PGRST116') {
      chatSession = (modernSessionQuery.data as SessionRow | null) ?? null
    } else if (isMissingSessionTelemetryColumnError(modernSessionQuery.error)) {
      sessionTelemetryAvailable = false
      const legacySessionQuery = await supabase
        .from('chat_sessions')
        .select(SESSION_SELECT_LEGACY)
        .eq('user_id', userId)
        .eq('mode', mode)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (legacySessionQuery.error && legacySessionQuery.error.code !== 'PGRST116') {
        console.error(legacySessionQuery.error)
        return NextResponse.json(
          { error: 'chat_session_unavailable', message: CHAT_SESSION_UNAVAILABLE_MESSAGE },
          { status: 500 },
        )
      }

      chatSession = (legacySessionQuery.data as SessionRow | null) ?? null
    } else {
      console.error(modernSessionQuery.error)
      return NextResponse.json(
        { error: 'chat_session_unavailable', message: CHAT_SESSION_UNAVAILABLE_MESSAGE },
        { status: 500 },
      )
    }

    const defaultSelection = await resolveProviderSelection(
      {
        preferredProvider: userProfile.default_provider,
        preferredModel: userProfile.default_model,
        hasAnthropicKey,
      },
    )

    const fallbackSelection = defaultSelection.ok
      ? defaultSelection.selection
      : {
          provider: 'openrouter' as const,
          model: DEFAULT_OPENROUTER_MODEL,
        }

    if (!chatSession) {
      return NextResponse.json({
        session: null,
        messages: [],
        freeQuota,
        selection: fallbackSelection,
      })
    }

    const selectionFromSession = await resolveProviderSelection(
      {
        preferredProvider: chatSession.provider ?? null,
        preferredModel: chatSession.model ?? null,
        hasAnthropicKey,
      },
    )

    const effectiveSelection = selectionFromSession.ok
      ? selectionFromSession.selection
      : fallbackSelection

    let messages: MessageRow[] = []
    let messageTelemetryAvailable = true

    let modernMessagesBuilder = supabase
      .from('chat_messages')
      .select(MESSAGE_SELECT_WITH_TELEMETRY)
      .eq('session_id', chatSession.id)
      .eq('user_id', userId)

    if (before && pageSize) {
      modernMessagesBuilder = modernMessagesBuilder.lt('created_at', before)
    }

    modernMessagesBuilder = modernMessagesBuilder.order('created_at', { ascending: pageSize === null })

    if (pageSize) {
      modernMessagesBuilder = modernMessagesBuilder.limit(pageSize + 1)
    }

    const modernMessagesQuery = await modernMessagesBuilder

    if (!modernMessagesQuery.error) {
      messages = (modernMessagesQuery.data as MessageRow[] | null) ?? []
    } else if (isMissingMessageTelemetryColumnError(modernMessagesQuery.error)) {
      messageTelemetryAvailable = false
      let legacyMessagesBuilder = supabase
        .from('chat_messages')
        .select(MESSAGE_SELECT_LEGACY)
        .eq('session_id', chatSession.id)
        .eq('user_id', userId)

      if (before && pageSize) {
        legacyMessagesBuilder = legacyMessagesBuilder.lt('created_at', before)
      }

      legacyMessagesBuilder = legacyMessagesBuilder.order('created_at', { ascending: pageSize === null })

      if (pageSize) {
        legacyMessagesBuilder = legacyMessagesBuilder.limit(pageSize + 1)
      }

      const legacyMessagesQuery = await legacyMessagesBuilder

      if (legacyMessagesQuery.error) {
        console.error(legacyMessagesQuery.error)
        return NextResponse.json(
          { error: 'chat_session_unavailable', message: CHAT_SESSION_UNAVAILABLE_MESSAGE },
          { status: 500 },
        )
      }

      messages = (legacyMessagesQuery.data as MessageRow[] | null) ?? []
    } else {
      console.error(modernMessagesQuery.error)
      return NextResponse.json(
        { error: 'chat_session_unavailable', message: CHAT_SESSION_UNAVAILABLE_MESSAGE },
        { status: 500 },
      )
    }

    const hasOlder = pageSize ? messages.length > pageSize : false
    const pagedMessagesDesc = pageSize
      ? messages.slice(0, pageSize)
      : messages
    const normalizedMessages = pageSize
      ? [...pagedMessagesDesc].reverse()
      : pagedMessagesDesc
    const nextBefore = hasOlder
      ? (pagedMessagesDesc[pagedMessagesDesc.length - 1]?.created_at ?? null)
      : null

    const legacyTotalTokens = messageTelemetryAvailable
      ? 0
      : normalizedMessages.reduce((sum, message) => sum + (message.role === 'assistant' ? (message.tokens_used ?? 0) : 0), 0)

    const userTurns = sessionTelemetryAvailable
      ? (chatSession.user_turns_count ?? estimateLegacyUserTurns(chatSession.message_count))
      : estimateLegacyUserTurns(chatSession.message_count)

    return NextResponse.json({
      session: {
        ...chatSession,
        provider: effectiveSelection.provider,
        model: effectiveSelection.model,
      },
      messages: normalizedMessages.map((m) => ({
        id: String(m.id),
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })),
      paging: {
        hasOlder,
        nextBefore,
      },
      freeQuota,
      selection: effectiveSelection,
      metrics: {
        userTurns,
        inputTokens: sessionTelemetryAvailable ? (chatSession.input_tokens_total ?? 0) : 0,
        outputTokens: sessionTelemetryAvailable ? (chatSession.output_tokens_total ?? 0) : 0,
        totalTokens: sessionTelemetryAvailable ? (chatSession.total_tokens_total ?? legacyTotalTokens) : legacyTotalTokens,
        estimatedCostMicrousd: sessionTelemetryAvailable ? (chatSession.estimated_cost_microusd_total ?? 0) : 0,
      },
    })
  } catch (error) {
    console.error('Failed to load chat session', error)
    return NextResponse.json(
      { error: 'chat_session_unavailable', message: CHAT_SESSION_UNAVAILABLE_MESSAGE },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const { mode, title, provider, model } = (await request.json().catch(() => ({}))) as {
      mode?: string
      title?: string
      provider?: string
      model?: string
    }

    if (!mode) {
      return NextResponse.json({ error: 'Mode is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const userProfile = await ensureUserProfile(userId, session.user.email)
    const hasAnthropicKey = await hasEncryptedProviderApiKey(userId, 'anthropic')

    const selection = await resolveProviderSelection(
      {
        preferredProvider: provider ?? userProfile.default_provider,
        preferredModel: model ?? userProfile.default_model,
        hasAnthropicKey,
      },
    )

    if (!selection.ok) {
      return NextResponse.json(selection.failure, { status: 403 })
    }

    await supabase
      .from('chat_sessions')
      .update({ is_archived: true })
      .eq('user_id', userId)
      .eq('mode', mode)
      .eq('is_archived', false)

    let newSession: SessionRow | null = null
    let sessionTelemetryAvailable = true

    const modernInsert = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        mode,
        title: title || `Chat - ${mode}`,
        provider: selection.selection.provider,
        model: selection.selection.model,
      })
      .select(SESSION_SELECT_WITH_TELEMETRY)
      .single()

    if (!modernInsert.error) {
      newSession = modernInsert.data as SessionRow
    } else if (isMissingSessionTelemetryColumnError(modernInsert.error)) {
      sessionTelemetryAvailable = false
      const legacyInsert = await supabase
        .from('chat_sessions')
        .insert({
          user_id: userId,
          mode,
          title: title || `Chat - ${mode}`,
        })
        .select(SESSION_SELECT_LEGACY)
        .single()

      if (legacyInsert.error) {
        console.error(legacyInsert.error)
        if (legacyInsert.error.code === '23503') {
          return NextResponse.json(
            { error: 'Unable to create chat session for this account. Please sign out and sign in again.' },
            { status: 409 },
          )
        }
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
      }

      newSession = legacyInsert.data as SessionRow
    } else {
      console.error(modernInsert.error)
      if (modernInsert.error.code === '23503') {
        return NextResponse.json(
          { error: 'Unable to create chat session for this account. Please sign out and sign in again.' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    const freeQuota = computeFreeQuota(userProfile)

    const { data: currentDefaults, error: profileDefaultsError } = await supabase
      .from('user_profiles')
      .select('default_provider, default_model')
      .eq('id', userId)
      .maybeSingle()

    if (profileDefaultsError) {
      console.warn('Unable to load current default provider/model on profile', profileDefaultsError)
    } else {
      const shouldUpdateDefaults = currentDefaults?.default_provider !== selection.selection.provider
        || currentDefaults?.default_model !== selection.selection.model

      if (shouldUpdateDefaults) {
        const { error: profileUpdateError } = await supabase
          .from('user_profiles')
          .update({
            default_provider: selection.selection.provider,
            default_model: selection.selection.model,
          })
          .eq('id', userId)

        if (profileUpdateError) {
          console.warn('Unable to persist default provider/model on profile', profileUpdateError)
        }
      }
    }

    const userTurns = sessionTelemetryAvailable
      ? (newSession?.user_turns_count ?? 0)
      : estimateLegacyUserTurns(newSession?.message_count)

    return NextResponse.json({
      session: {
        ...newSession,
        provider: selection.selection.provider,
        model: selection.selection.model,
      },
      freeQuota,
      selection: selection.selection,
      metrics: {
        userTurns,
        inputTokens: sessionTelemetryAvailable ? (newSession?.input_tokens_total ?? 0) : 0,
        outputTokens: sessionTelemetryAvailable ? (newSession?.output_tokens_total ?? 0) : 0,
        totalTokens: sessionTelemetryAvailable ? (newSession?.total_tokens_total ?? 0) : 0,
        estimatedCostMicrousd: sessionTelemetryAvailable ? (newSession?.estimated_cost_microusd_total ?? 0) : 0,
      },
    })
  } catch (error) {
    console.error('Failed to create chat session', error)
    return NextResponse.json(
      { error: 'chat_session_unavailable', message: CHAT_SESSION_UNAVAILABLE_MESSAGE },
      { status: 500 },
    )
  }
}
