'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { BookOpen, FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MemoryPage() {
  const [files, setFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/memory')
      .then(res => res.json())
      .then(data => {
        const fileList = data.files || []
        setFiles(fileList)
        if (fileList.length > 0 && !selectedFile) {
          setSelectedFile(fileList[0])
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedFile) return
    setLoading(true)
    fetch(`/api/memory?file=${encodeURIComponent(selectedFile)}`)
      .then(res => res.json())
      .then(data => setContent(data.content || ''))
      .catch(() => setContent(''))
      .finally(() => setLoading(false))
  }, [selectedFile])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Memory</h1>
        <p className="text-muted-foreground text-sm mt-1">Read-only view of your workspace files</p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        {/* File Sidebar */}
        <Card className="w-48 shrink-0 border-border bg-surface">
          <CardContent className="p-2">
            <ScrollArea className="h-full">
              <div className="space-y-0.5">
                {files.map(file => (
                  <button
                    key={file}
                    onClick={() => setSelectedFile(file)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors',
                      selectedFile === file
                        ? 'bg-streak/10 text-streak font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-elevated'
                    )}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    {file}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Markdown Preview */}
        <Card className="flex-1 border-border bg-surface overflow-hidden">
          <CardContent className="p-0 h-full">
            <ScrollArea className="h-full">
              <div className="p-6">
                {loading ? (
                  <div className="text-muted-foreground text-sm">Loading...</div>
                ) : content ? (
                  <div className="prose prose-invert prose-sm max-w-none
                    prose-headings:font-display prose-headings:text-foreground
                    prose-p:text-foreground/90
                    prose-a:text-coach prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-foreground
                    prose-code:text-dsa prose-code:bg-elevated prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                    prose-pre:bg-elevated prose-pre:border prose-pre:border-border
                    prose-table:text-sm
                    prose-th:text-muted-foreground prose-th:font-medium
                    prose-td:text-foreground/80
                    prose-hr:border-border
                    prose-blockquote:border-l-coach/30 prose-blockquote:text-muted-foreground
                    prose-li:text-foreground/90
                  ">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <div className="text-center">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Select a file to view</p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
