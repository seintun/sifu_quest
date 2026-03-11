'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import type { ParsedSystemDesign } from '@/lib/parsers/system-design'
import { parseSystemDesign } from '@/lib/parsers/system-design'
import { DOMAIN_COLORS } from '@/lib/theme'
import { AlertCircle, BookOpen, CheckCircle2, Lightbulb, Network, Plus, Zap } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'

function LogConceptForm({ onSubmit }: { onSubmit: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    concept: '',
    depthCovered: 'Overview',
    notes: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!form.concept) return
    setLoading(true)
    try {
      const res = await fetch('/api/system-design/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setOpen(false)
        setForm({ concept: '', depthCovered: 'Overview', notes: '' })
        onSubmit()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="sm" className="gap-1.5" />}
      >
        <Plus className="h-4 w-4" /> Log Concept
      </DialogTrigger>
      <DialogContent className="bg-surface border-border">
        <DialogHeader>
          <DialogTitle>Log a Concept</DialogTitle>
          <DialogDescription>Record a system design concept you&apos;ve studied.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="sd-concept">Concept Name</Label>
            <Input
              id="sd-concept"
              value={form.concept}
              onChange={e => setForm({ ...form, concept: e.target.value })}
              placeholder="e.g., Rate Limiter"
              className="bg-elevated border-border mt-1"
            />
          </div>
          <div>
            <Label>Depth Covered</Label>
            <Select value={form.depthCovered} onValueChange={v => v && setForm({ ...form, depthCovered: v })}>
              <SelectTrigger className="bg-elevated border-border mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Overview">Overview</SelectItem>
                <SelectItem value="Deep Dive">Deep Dive</SelectItem>
                <SelectItem value="Implemented">Implemented</SelectItem>
                <SelectItem value="Mock Interview">Mock Interview</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="sd-notes">Notes (optional)</Label>
            <Input
              id="sd-notes"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Key takeaway..."
              className="bg-elevated border-border mt-1"
            />
          </div>
          <Button onClick={handleSubmit} disabled={loading || !form.concept} className="w-full">
            {loading ? 'Saving...' : 'Log Concept'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}



export default function SystemDesignPage() {
  const { data: rawData, mutate } = useSWR('/api/memory?file=system-design.md', fetcher)
  
  const data = rawData ? parseSystemDesign(rawData.content || '') : null

  // Find next topic to study
  const coveredTopics = data ? new Set(data.concepts.map(c => c.concept.toLowerCase())) : new Set()
  const nextTopic = data ? data.referenceTopics.find(t => !coveredTopics.has(t.toLowerCase())) : null
  const coveredCount = data ? data.referenceTopics.filter(t => coveredTopics.has(t.toLowerCase())).length : 0
  const totalTopics = data ? data.referenceTopics.length : 0
  const coveragePct = totalTopics > 0 ? Math.round((coveredCount / totalTopics) * 100) : 0

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">System Design</h1>
          <p className="text-muted-foreground text-sm mt-1">Concepts, discussions, and study plan</p>
        </div>
        {data ? (
          <LogConceptForm onSubmit={() => mutate()} />
        ) : (
          <div className="h-9 w-32 bg-muted rounded-md animate-pulse" />
        )}
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {(!data) ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={`skel-${i}`} className="bg-design/5 border-design/10 animate-pulse">
              <CardContent className="p-4 space-y-2">
                <div className="h-3 w-16 bg-muted/60 rounded" />
                <div className="h-8 w-12 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted/40 rounded" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className={`${DOMAIN_COLORS.design.bg} border ${DOMAIN_COLORS.design.border}`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Concepts</p>
                <p className="text-2xl font-display font-bold text-design mt-1">{data.concepts.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">studied</p>
              </CardContent>
            </Card>
            <Card className={`${DOMAIN_COLORS.design.bg} border ${DOMAIN_COLORS.design.border}`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Coverage</p>
                <p className="text-2xl font-display font-bold text-design mt-1">{coveredCount}/{totalTopics}</p>
                <div className="h-1 rounded-full bg-elevated overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${coveragePct}%`,
                      background: `linear-gradient(to right, ${DOMAIN_COLORS.design.hex}, #6366F1)`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className={`${DOMAIN_COLORS.design.bg} border ${DOMAIN_COLORS.design.border}`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Gaps</p>
                <p className="text-2xl font-display font-bold text-design mt-1">{data.gaps.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">to revisit</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Study Next Card */}
      {!data ? (
        <Card className="bg-design/5 border border-design/10 animate-pulse">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full bg-muted shrink-0" />
              <div className="space-y-2 w-full">
                <div className="h-3 w-24 bg-muted/60 rounded" />
                <div className="h-6 w-48 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted/40 rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : nextTopic ? (
        <Card className="bg-design/10 border border-design/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Lightbulb className="h-5 w-5 text-design" />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Study Next</p>
                <p className="text-lg font-display font-semibold text-design">{nextTopic}</p>
                <Link href="/coach" className="text-xs text-coach hover:underline mt-1 inline-block">
                  Discuss with coach →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Concepts Grid */}
      <Card className="border-border bg-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Network className="h-4 w-4 text-design" />
            Concepts Covered
            <Badge variant="outline" className="ml-auto">{data?.concepts.length || 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-8 w-full bg-muted/40 rounded" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 w-1/4 bg-muted rounded" />
                  <div className="h-4 w-1/4 bg-muted rounded" />
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-4 w-1/3 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : data.concepts.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No concepts covered yet. Use the &quot;Log Concept&quot; button or start a session with the coach!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concept</TableHead>
                  <TableHead>Depth</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.concepts.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.concept}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        c.depthCovered === 'Implemented' ? 'text-streak border-streak/30' :
                        c.depthCovered === 'Deep Dive' ? 'text-design border-design/30' :
                        c.depthCovered === 'Mock Interview' ? 'text-dsa border-dsa/30' :
                        'text-muted-foreground'
                      }>
                        {c.depthCovered}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.date}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Discussions Log */}
      {data && data.discussions.length > 0 && (
        <Card className="border-border bg-surface">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-design" />
              Key Discussions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.discussions.map((d, i) => (
              <div key={i} className="border-l-2 border-design/30 pl-3">
                <h3 className="text-sm font-medium text-foreground">{d.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{d.content.trim()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Patterns & Trade-offs */}
      {data && data.gaps.length > 0 && (
        <Card className="border-border bg-surface">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              Known Gaps to Revisit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {data.gaps.map((g, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-warning mt-1">•</span>
                  {g}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Reference Topics */}
      <Card className="border-border bg-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-design" />
            Reference Topics
            <Badge variant="outline" className="ml-auto text-xs">
              {coveredCount}/{totalTopics} covered
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
            <div className="flex flex-wrap gap-2 animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`badge-skel-${i}`} className="h-6 w-24 bg-muted/40 rounded-full" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.referenceTopics.map(topic => {
                const covered = coveredTopics.has(topic.toLowerCase())
                return (
                  <Badge
                    key={topic}
                    variant="outline"
                    className={covered
                      ? 'bg-streak/20 text-streak border-streak/30'
                      : 'text-muted-foreground'
                    }
                  >
                    {covered && <CheckCircle2 className="h-3 w-3 mr-1" />}{topic}
                  </Badge>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
