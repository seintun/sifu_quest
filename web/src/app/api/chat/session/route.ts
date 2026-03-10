import { auth } from '@/auth'
import { ensureUserProfile } from '@/lib/account-state'
import { resolveProviderSelection } from '@/lib/chat-selection'
import { computeFreeQuota } from '@/lib/free-quota'
import { hasEncryptedProviderApiKey } from '@/lib/provider-api-keys'
import { createAdminClient } from '@/lib/supabase-admin'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
const CHAT_SESSION_UNAVAILABLE_MESSAGE = 'We could not load your chat right now. Please refresh and try again.'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')

    if (!mode) {
      return NextResponse.json({ error: 'Mode is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const userProfile = await ensureUserProfile(userId, session.user.email)
    const hasAnthropicKey = await hasEncryptedProviderApiKey(userId, 'anthropic')
    const freeQuota = computeFreeQuota(userProfile)

    const { data: chatSession, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, message_count, provider, model, user_turns_count, input_tokens_total, output_tokens_total, total_tokens_total, estimated_cost_microusd_total')
      .eq('user_id', userId)
      .eq('mode', mode)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (sessionError && sessionError.code !== 'PGRST116') {
      console.error(sessionError)
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
          model: 'openai/gpt-oss-20b:free',
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
        preferredProvider: chatSession.provider,
        preferredModel: chatSession.model,
        hasAnthropicKey,
      },
    )

    const effectiveSelection = selectionFromSession.ok
      ? selectionFromSession.selection
      : fallbackSelection

    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('role, content, created_at, provider, model, input_tokens, output_tokens, total_tokens, estimated_cost_microusd, latency_ms')
      .eq('session_id', chatSession.id)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error(messagesError)
      return NextResponse.json(
        { error: 'chat_session_unavailable', message: CHAT_SESSION_UNAVAILABLE_MESSAGE },
        { status: 500 },
      )
    }

    return NextResponse.json({
      session: {
        ...chatSession,
        provider: effectiveSelection.provider,
        model: effectiveSelection.model,
      },
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      freeQuota,
      selection: effectiveSelection,
      metrics: {
        userTurns: chatSession.user_turns_count ?? 0,
        inputTokens: chatSession.input_tokens_total ?? 0,
        outputTokens: chatSession.output_tokens_total ?? 0,
        totalTokens: chatSession.total_tokens_total ?? 0,
        estimatedCostMicrousd: chatSession.estimated_cost_microusd_total ?? 0,
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

    const { data: newSession, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        mode,
        title: title || `Chat - ${mode}`,
        provider: selection.selection.provider,
        model: selection.selection.model,
      })
      .select('id, title, created_at, message_count, provider, model, user_turns_count, input_tokens_total, output_tokens_total, total_tokens_total, estimated_cost_microusd_total')
      .single()

    const freeQuota = computeFreeQuota(userProfile)

    if (error) {
      console.error(error)
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Unable to create chat session for this account. Please sign out and sign in again.' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    // Persist account-level defaults for future sessions.
    await supabase
      .from('user_profiles')
      .update({
        default_provider: selection.selection.provider,
        default_model: selection.selection.model,
      })
      .eq('id', userId)

    return NextResponse.json({
      session: newSession,
      freeQuota,
      selection: selection.selection,
      metrics: {
        userTurns: newSession.user_turns_count ?? 0,
        inputTokens: newSession.input_tokens_total ?? 0,
        outputTokens: newSession.output_tokens_total ?? 0,
        totalTokens: newSession.total_tokens_total ?? 0,
        estimatedCostMicrousd: newSession.estimated_cost_microusd_total ?? 0,
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
