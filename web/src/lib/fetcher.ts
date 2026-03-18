export const fetcher = async (url: string): Promise<unknown> => {
  const res = await fetch(url)

  const text = await res.text()
  let data: unknown = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const body = data as Record<string, unknown> | null
    const message =
      (body && (String(body.error || body.message))) ||
      res.statusText ||
      'Request failed'

    const error = new Error(message) as Error & { status: number; data: unknown }
    error.status = res.status
    error.data = data

    throw error
  }

  return data
}
