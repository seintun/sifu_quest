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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { KANBAN_COLORS } from '@/lib/theme'
import { parseJobApplications } from '@/lib/parsers/job-search'
import type { JobApplication } from '@/lib/parsers/job-search'
import { Briefcase, Plus, AlertTriangle } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'

const STATUSES = ['Applied', 'PhoneScreen', 'Onsite', 'Offer', 'Rejected']

function ApplicationCard({
  app,
  onStatusChange,
}: {
  app: JobApplication
  onStatusChange: (company: string, role: string, status: string) => void
}) {
  const isStale = app.status === 'Applied' &&
    app.dateApplied !== '—' &&
    differenceInDays(new Date(), parseISO(app.dateApplied)) > 21

  return (
    <Card className={`border-l-4 ${KANBAN_COLORS[app.status] || 'border-l-border'} bg-surface border-border`}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-sm">{app.company}</p>
            <p className="text-xs text-muted-foreground">{app.role}</p>
          </div>
          {isStale && (
            <Badge className="bg-warning/20 text-warning border-warning/30 text-xs gap-1">
              <AlertTriangle className="h-3 w-3" /> Stale
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-dim">{app.dateApplied}</span>
          <Select
            value={app.status}
            onValueChange={v => v && onStatusChange(app.company, app.role, v)}
          >
            <SelectTrigger className="h-6 w-28 text-xs bg-elevated border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {app.notes && <p className="text-xs text-muted-foreground mt-1.5">{app.notes}</p>}
      </CardContent>
    </Card>
  )
}

function AddApplicationForm({ onSubmit }: { onSubmit: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    company: '',
    role: '',
    status: 'Applied',
    notes: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!form.company || !form.role) return
    setLoading(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          ...form,
          dateApplied: new Date().toISOString().split('T')[0],
        }),
      })
      if (res.ok) {
        setOpen(false)
        setForm({ company: '', role: '', status: 'Applied', notes: '' })
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
        <Plus className="h-4 w-4" /> Add Application
      </DialogTrigger>
      <DialogContent className="bg-surface border-border">
        <DialogHeader>
          <DialogTitle>Add Application</DialogTitle>
          <DialogDescription>Track a new job application.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Company</Label>
            <Input
              value={form.company}
              onChange={e => setForm({ ...form, company: e.target.value })}
              placeholder="e.g., Google"
              className="bg-elevated border-border mt-1"
            />
          </div>
          <div>
            <Label>Role</Label>
            <Input
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              placeholder="e.g., Senior Software Engineer"
              className="bg-elevated border-border mt-1"
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => v && setForm({ ...form, status: v })}>
              <SelectTrigger className="bg-elevated border-border mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Referral from..."
              className="bg-elevated border-border mt-1"
            />
          </div>
          <Button onClick={handleSubmit} disabled={loading || !form.company || !form.role} className="w-full">
            {loading ? 'Saving...' : 'Add Application'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}



export default function JobsPage() {
  const { data, mutate } = useSWR('/api/memory?file=job-search.md', fetcher)
  
  const applications = data ? parseJobApplications(data.content || '') : null

  const handleStatusChange = async (company: string, role: string, newStatus: string) => {
    await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateStatus', company, role, newStatus }),
    })
    mutate()
  }

  // Group by status for Kanban view
  const columns = STATUSES.map(status => ({
    status,
    apps: applications ? applications.filter(a => a.status === status) : [],
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Job Search</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {applications ? `${applications.length} application${applications.length !== 1 ? 's' : ''} tracked` : 'Loading applications...'}
          </p>
        </div>
        {applications ? (
          <AddApplicationForm onSubmit={() => mutate()} />
        ) : (
          <div className="h-9 w-36 bg-muted rounded-md animate-pulse" />
        )}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {!applications ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-muted" />
                <div className="h-5 w-24 bg-muted/80 rounded" />
                <div className="h-5 w-8 bg-muted/40 rounded-full ml-auto" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: i === 0 ? 3 : i === 1 ? 2 : 1 }).map((_, j) => (
                  <Card key={j} className="bg-surface border-border">
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-muted rounded" />
                        <div className="h-3 w-40 bg-muted/60 rounded" />
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="h-3 w-16 bg-muted/40 rounded" />
                        <div className="h-6 w-28 bg-muted rounded" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        ) : (
          columns.map(col => (
            <div key={col.status}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${
                  col.status === 'Applied' ? 'bg-coach' :
                  col.status === 'PhoneScreen' ? 'bg-jobs' :
                  col.status === 'Onsite' ? 'bg-design' :
                  col.status === 'Offer' ? 'bg-streak' :
                  'bg-border'
                }`} />
                <h3 className="text-sm font-medium">{col.status}</h3>
                <Badge variant="outline" className="text-xs">{col.apps.length}</Badge>
              </div>
              <div className="space-y-2">
                {col.apps.map((app, i) => (
                  <ApplicationCard
                    key={`${app.company}-${app.role}-${i}`}
                    app={app}
                    onStatusChange={handleStatusChange}
                  />
                ))}
                {col.apps.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-dim">
                    No applications
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
