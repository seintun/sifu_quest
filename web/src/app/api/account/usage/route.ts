import { auth } from '@/auth'
import { isMissingMessageTelemetryColumnError } from '@/lib/chat-schema-compat'
import { createAdminClient } from '@/lib/supabase-admin'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type UsageAccumulator = {
  userTurns: number
  assistantTurns: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostMicrousd: number
}

type UsageRow = {
  role: string
  provider?: string | null
  model?: string | null
  created_at: string
  input_tokens?: number | null
  output_tokens?: number | null
  total_tokens?: number | null
  estimated_cost_microusd?: number | null
  tokens_used?: number | null
}

function createAccumulator(): UsageAccumulator {
  return {
    userTurns: 0,
    assistantTurns: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostMicrousd: 0,
  }
}

function addToAccumulator(target: UsageAccumulator, delta: Partial<UsageAccumulator>): void {
  target.userTurns += delta.userTurns ?? 0
  target.assistantTurns += delta.assistantTurns ?? 0
  target.inputTokens += delta.inputTokens ?? 0
  target.outputTokens += delta.outputTokens ?? 0
  target.totalTokens += delta.totalTokens ?? 0
  target.estimatedCostMicrousd += delta.estimatedCostMicrousd ?? 0
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const supabase = createAdminClient()
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const modernMessages = await supabase
      .from('chat_messages')
      .select('role, provider, model, created_at, input_tokens, output_tokens, total_tokens, estimated_cost_microusd')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    let allMessages: UsageRow[] = []
    let telemetryColumnsAvailable = true

    if (!modernMessages.error) {
      allMessages = (modernMessages.data as UsageRow[] | null) ?? []
    } else if (isMissingMessageTelemetryColumnError(modernMessages.error)) {
      telemetryColumnsAvailable = false
      const legacyMessages = await supabase
        .from('chat_messages')
        .select('role, created_at, tokens_used')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (legacyMessages.error) {
        throw new Error(legacyMessages.error.message)
      }

      allMessages = (legacyMessages.data as UsageRow[] | null) ?? []
    } else {
      throw new Error(modernMessages.error.message)
    }

    const lifetime = createAccumulator()
    const trailing30Days = createAccumulator()
    const providerBreakdown = new Map<string, UsageAccumulator>()
    const modelBreakdown = new Map<string, UsageAccumulator>()

    for (const row of allMessages ?? []) {
      const isUserTurn = row.role === 'user'
      const createdAt = typeof row.created_at === 'string' ? row.created_at : ''
      const inTrailingWindow = createdAt >= cutoff

      const delta: Partial<UsageAccumulator> = isUserTurn
        ? { userTurns: 1 }
        : {
            assistantTurns: 1,
            inputTokens: telemetryColumnsAvailable ? (row.input_tokens ?? 0) : 0,
            outputTokens: telemetryColumnsAvailable ? (row.output_tokens ?? 0) : 0,
            totalTokens: telemetryColumnsAvailable ? (row.total_tokens ?? 0) : (row.tokens_used ?? 0),
            estimatedCostMicrousd: telemetryColumnsAvailable ? (row.estimated_cost_microusd ?? 0) : 0,
          }

      addToAccumulator(lifetime, delta)
      if (inTrailingWindow) {
        addToAccumulator(trailing30Days, delta)
      }

      if (!isUserTurn) {
        const providerKey = telemetryColumnsAvailable ? (row.provider || 'unknown') : 'legacy'
        const modelKey = telemetryColumnsAvailable
          ? `${providerKey}::${row.model || 'unknown'}`
          : 'legacy::legacy'

        if (!providerBreakdown.has(providerKey)) {
          providerBreakdown.set(providerKey, createAccumulator())
        }
        if (!modelBreakdown.has(modelKey)) {
          modelBreakdown.set(modelKey, createAccumulator())
        }

        addToAccumulator(providerBreakdown.get(providerKey)!, delta)
        addToAccumulator(modelBreakdown.get(modelKey)!, delta)
      }
    }

    return NextResponse.json({
      lifetime,
      trailing30Days,
      providerBreakdown: Array.from(providerBreakdown.entries()).map(([provider, usage]) => ({
        provider,
        ...usage,
      })),
      modelBreakdown: Array.from(modelBreakdown.entries()).map(([compoundKey, usage]) => {
        const [provider, model] = compoundKey.split('::')
        return {
          provider,
          model,
          ...usage,
        }
      }),
    })
  } catch (error) {
    console.error('Failed to load account usage metrics', error)
    return NextResponse.json(
      { error: 'usage_unavailable', message: 'Unable to load usage metrics right now.' },
      { status: 500 },
    )
  }
}
