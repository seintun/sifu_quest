import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyRound, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export function ApiKeyPrompt() {
  return (
    <div className="flex justify-center my-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="max-w-md w-full border-primary/30 bg-primary/5 shadow-lg shadow-primary/10 backdrop-blur-sm">
        <CardHeader className="pb-3 text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center mb-2">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Free Messages Exhausted</CardTitle>
          <CardDescription className="text-foreground/80">
            You've reached the free-tier limit on the shared platform key. 
            To continue chatting, please provide your own Anthropic API key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="bg-background/80 rounded-lg p-4 space-y-3 border border-border/50 text-sm">
             <div className="flex items-start gap-3">
               <div className="bg-green-500/10 p-1.5 rounded-md shrink-0"><ShieldCheck className="w-4 h-4 text-green-500" /></div>
               <p className="leading-snug"><strong>Secure Storage:</strong> Your key is AES-256 encrypted at rest and never shared.</p>
             </div>
          </div>
          <div className="pt-2">
            <Link href="/settings" className={cn(buttonVariants(), "w-full font-medium")}>
              Go to Settings
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
