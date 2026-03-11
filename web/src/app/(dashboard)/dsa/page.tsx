'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MASTERY_STYLES, DOMAIN_COLORS } from '@/lib/theme'
import type { MasteryLevel } from '@/lib/theme'
import { parseDSAPatterns, parseProblemHistory } from '@/lib/parsers/dsa-patterns'
import type { DSAPattern, ProblemAttempt } from '@/lib/parsers/dsa-patterns'
import { Code2, Plus, Lightbulb, History } from 'lucide-react'

function MasteryBadge({ level }: { level: MasteryLevel }) {
  const style = MASTERY_STYLES[level]
  return (
    <Badge className={`${style.className} text-xs`}>
      {level} {style.label}
    </Badge>
  )
}

function LogProblemForm({
  patterns,
  onSubmit,
}: {
  patterns: DSAPattern[]
  onSubmit: () => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    problem: '',
    difficulty: 'Medium',
    pattern: '',
    outcome: 'Solved',
    notes: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!form.problem || !form.pattern) return
    setLoading(true)
    try {
      const res = await fetch('/api/dsa/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          date: new Date().toISOString().split('T')[0],
        }),
      })
      if (res.ok) {
        setOpen(false)
        setForm({ problem: '', difficulty: 'Medium', pattern: '', outcome: 'Solved', notes: '' })
        onSubmit()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-1.5" />
        }
      >
        <Plus className="h-4 w-4" /> Log Problem
      </DialogTrigger>
      <DialogContent className="bg-surface border-border">
        <DialogHeader>
          <DialogTitle>Log a Problem</DialogTitle>
          <DialogDescription>Record a DSA problem you&apos;ve attempted.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Problem Name</Label>
            <Input
              value={form.problem}
              onChange={e => setForm({ ...form, problem: e.target.value })}
              placeholder="e.g., Two Sum"
              className="bg-elevated border-border mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onValueChange={v => v && setForm({ ...form, difficulty: v })}>
                <SelectTrigger className="bg-elevated border-border mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pattern</Label>
              <Select value={form.pattern} onValueChange={v => v && setForm({ ...form, pattern: v })}>
                <SelectTrigger className="bg-elevated border-border mt-1">
                  <SelectValue placeholder="Select pattern" />
                </SelectTrigger>
                <SelectContent>
                  {patterns.map(p => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Outcome</Label>
            <Select value={form.outcome} onValueChange={v => v && setForm({ ...form, outcome: v })}>
              <SelectTrigger className="bg-elevated border-border mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Solved">Solved</SelectItem>
                <SelectItem value="Solved with hints">Solved with hints</SelectItem>
                <SelectItem value="Struggled">Struggled</SelectItem>
                <SelectItem value="Could not solve">Could not solve</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Key takeaway..."
              className="bg-elevated border-border mt-1"
            />
          </div>
          <Button onClick={handleSubmit} disabled={loading || !form.problem || !form.pattern} className="w-full">
            {loading ? 'Saving...' : 'Log Problem'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}



export default function DSAPage() {
  const { data, mutate } = useSWR('/api/memory?file=dsa-patterns.md', fetcher)

  const content = data?.content || ''
  const patterns = data ? parseDSAPatterns(content) : null
  const problems = data ? parseProblemHistory(content) : []

  // Find the first pattern needing practice
  const suggestedPattern = patterns?.find(p => p.mastery === '—' || p.mastery === '🔴')

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">DSA Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">Pattern mastery & problem history</p>
        </div>
        {patterns ? (
          <LogProblemForm patterns={patterns} onSubmit={() => mutate()} />
        ) : (
          <div className="h-9 w-32 bg-muted rounded-md animate-pulse" />
        )}
      </div>

      {/* Problem of the Day */}
      {!patterns ? (
        <Card className="bg-dsa/5 border-dsa/10 animate-pulse">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full bg-muted shrink-0" />
              <div className="space-y-2 w-full">
                <div className="h-3 w-32 bg-muted/60 rounded" />
                <div className="h-5 w-48 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted/60 rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : suggestedPattern ? (
        <Card className="bg-dsa/10 border border-dsa/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Lightbulb className="h-5 w-5 text-dsa" />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Suggested Next Pattern</p>
                <p className="text-lg font-display font-semibold text-dsa">{suggestedPattern.name}</p>
                <p className="text-sm text-muted-foreground">{suggestedPattern.problemsSeen} problems seen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Pattern Mastery Table */}
      <Card className="border-border bg-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Code2 className="h-4 w-4 text-dsa" />
            Pattern Mastery
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!patterns ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-8 w-full bg-muted/40 rounded" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 w-1/4 bg-muted rounded" />
                  <div className="h-4 w-1/4 bg-muted rounded" />
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-4 w-1/3 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Mastery</TableHead>
                  <TableHead className="text-right">Problems</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patterns.map(pattern => (
                  <TableRow key={pattern.name}>
                    <TableCell className="font-medium">{pattern.name}</TableCell>
                    <TableCell>
                      <MasteryBadge level={pattern.mastery} />
                    </TableCell>
                    <TableCell className="text-right">{pattern.problemsSeen}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{pattern.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Problem History */}
      <Card className="border-border bg-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4 text-dsa" />
            Problem History
            <Badge variant="outline" className="ml-auto">{problems.length} problems</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!patterns ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-8 w-full bg-muted/40 rounded" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 w-1/4 bg-muted rounded" />
                  <div className="h-4 w-1/4 bg-muted rounded" />
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-4 w-1/3 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : problems.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No problems logged yet. Use the &quot;Log Problem&quot; button to get started!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Problem</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {problems.slice().reverse().map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.problem}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        p.difficulty === 'Easy' ? 'text-streak border-streak/30' :
                        p.difficulty === 'Hard' ? 'text-plan border-plan/30' :
                        'text-jobs border-jobs/30'
                      }>
                        {p.difficulty}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.pattern}</TableCell>
                    <TableCell className="text-sm">{p.outcome}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
