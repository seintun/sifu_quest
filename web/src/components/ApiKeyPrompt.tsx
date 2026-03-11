import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyRound, X } from 'lucide-react'
import Link from 'next/link'

interface ApiKeyPromptProps {
  onClose?: () => void
}

export function ApiKeyPrompt({ onClose }: ApiKeyPromptProps = {}) {
  return (
    <div className="flex justify-center my-3 md:my-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="max-w-[21.5rem] md:max-w-md w-full border-primary/30 bg-primary/5 shadow-lg shadow-primary/10 backdrop-blur-sm relative">
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-2.5 right-2.5 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors"
            aria-label="Dismiss API key prompt"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <CardHeader className="pb-2 pt-5 text-center">
          <div className="mx-auto bg-primary/10 p-2 rounded-full w-10 h-10 flex items-center justify-center mb-2">
            <KeyRound className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-lg md:text-xl">Free Limit Reached</CardTitle>
          <CardDescription className="text-sm text-foreground/80">
            Add your Anthropic BYOK in Settings for unlimited AI chat usage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pt-2 pb-4">
          <p className="text-xs text-muted-foreground text-center px-1">
            Visit Settings to add your key and continue chatting.
          </p>
          <div className="pt-1">
            <Link href="/settings" className={cn(buttonVariants(), "w-full h-10 font-medium")}>
              Go to Settings
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
