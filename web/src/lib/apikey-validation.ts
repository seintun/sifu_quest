export type ApiKeyValidationResult =
  | { ok: true }
  | { ok: false; code: 'invalid_key' | 'validation_unavailable'; error: string }

export async function validateAnthropicApiKey(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiKeyValidationResult> {
  try {
    const response = await fetchImpl('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })

    if (response.ok) {
      return { ok: true }
    }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, code: 'invalid_key', error: 'Invalid Anthropic API key.' }
    }

    return {
      ok: false,
      code: 'validation_unavailable',
      error: 'Unable to validate your API key right now. Please try again.',
    }
  } catch {
    return {
      ok: false,
      code: 'validation_unavailable',
      error: 'Unable to validate your API key right now. Please try again.',
    }
  }
}

export async function validateOpenRouterApiKey(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApiKeyValidationResult> {
  try {
    const response = await fetchImpl('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })

    if (response.ok) {
      return { ok: true }
    }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, code: 'invalid_key', error: 'Invalid OpenRouter API key.' }
    }

    return {
      ok: false,
      code: 'validation_unavailable',
      error: 'Unable to validate your API key right now. Please try again.',
    }
  } catch {
    return {
      ok: false,
      code: 'validation_unavailable',
      error: 'Unable to validate your API key right now. Please try again.',
    }
  }
}
