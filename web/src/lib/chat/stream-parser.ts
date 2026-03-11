export type ParsedStreamFrame = {
  text?: string
  error?: string
  type?: string
  status?: 'idle' | 'thinking' | 'typing'
  provider?: 'openrouter' | 'anthropic'
  model?: string
  inputTokens?: number | null
  outputTokens?: number | null
  totalTokens?: number | null
  estimatedCostMicrousd?: number | null
}

export async function consumeChatStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onFrame: (frame: ParsedStreamFrame) => void,
): Promise<void> {
  const decoder = new TextDecoder()
  let buffered = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffered += decoder.decode(value, { stream: true })
    const lines = buffered.split('\n')
    buffered = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data:')) continue

      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue

      try {
        onFrame(JSON.parse(payload) as ParsedStreamFrame)
      } catch {
        // Ignore malformed payload chunks.
      }
    }
  }

  // Flush any trailing decoder buffer to avoid dropping split multi-byte characters.
  buffered += decoder.decode()

  if (buffered.length > 0) {
    const line = buffered.trim()
    if (line.startsWith('data:')) {
      const payload = line.slice(5).trim()
      if (payload.length > 0 && payload !== '[DONE]') {
        try {
          onFrame(JSON.parse(payload) as ParsedStreamFrame)
        } catch {
          // Ignore malformed final chunk.
        }
      }
    }
  }
}
