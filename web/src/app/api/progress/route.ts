import { NextResponse } from 'next/server'
import { computeMetrics } from '@/lib/metrics'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const metrics = await computeMetrics()
    return NextResponse.json(metrics)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
