type SessionLike = {
  user?: {
    id?: string | null
    email?: string | null
  } | null
} | null

type ProgressHandlerDeps<TMetrics> = {
  authFn: () => Promise<SessionLike>
  resolveUserIdFn: (userId: string, email?: string | null) => Promise<string>
  computeMetricsFn: (userId: string) => Promise<TMetrics>
}

export type ProgressGetResult<TMetrics> =
  | { status: 200; body: TMetrics }
  | { status: 401 | 500; body: { error: string } }

export function createProgressGetHandler<TMetrics>({
  authFn,
  resolveUserIdFn,
  computeMetricsFn,
}: ProgressHandlerDeps<TMetrics>) {
  return async function handleProgressGet(): Promise<ProgressGetResult<TMetrics>> {
    try {
      const session = await authFn()
      if (!session?.user?.id) {
        return { status: 401, body: { error: 'Unauthorized' } }
      }

      const userId = await resolveUserIdFn(session.user.id, session.user.email)
      const metrics = await computeMetricsFn(userId)
      return { status: 200, body: metrics }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { status: 500, body: { error: message } }
    }
  }
}
