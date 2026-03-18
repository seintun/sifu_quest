// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SWR requires any for flexible typing
export const fetcher = async (url: string): Promise<any> => {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- error augmentation pattern
    const error: any = new Error(message)
    error.status = res.status
    error.data = data

    throw error
  }

  return data
}
