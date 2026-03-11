export const PLAN_JOB_STALE_MS = 10 * 60 * 1000

export function getBackoffDelayMs(attemptCount: number): number {
  // 2m, 4m, 8m
  const minutes = 2 ** Math.max(1, attemptCount)
  return minutes * 60 * 1000
}

export function getPlanRetryState(
  attemptCount: number,
  nowMs: number = Date.now(),
): { exhausted: boolean; nextStatus: 'queued' | 'failed'; availableAtIso: string } {
  const exhausted = attemptCount >= 3
  if (exhausted) {
    return {
      exhausted: true,
      nextStatus: 'failed',
      availableAtIso: new Date(nowMs).toISOString(),
    }
  }

  return {
    exhausted: false,
    nextStatus: 'queued',
    availableAtIso: new Date(nowMs + getBackoffDelayMs(attemptCount)).toISOString(),
  }
}

export function isPlanJobRunningStale(
  updatedAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  const updatedAtMs = updatedAt ? new Date(updatedAt).getTime() : NaN
  return Number.isNaN(updatedAtMs) || nowMs - updatedAtMs > PLAN_JOB_STALE_MS
}
