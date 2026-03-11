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
    const body = data as any
    const message =
      (body && (body.error || body.message)) ||
      res.statusText ||
      'Request failed'

    const error: any = new Error(message)
    error.status = res.status
    error.data = data

    throw error
  }

  return data
}
