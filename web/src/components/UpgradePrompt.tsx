'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { startGuestGoogleUpgrade } from '@/lib/guest-upgrade'
import { Rocket, UserPlus, X } from 'lucide-react'
import { useState } from 'react'

interface UpgradePromptProps {
  onClose?: () => void
}

export function UpgradePrompt({ onClose }: UpgradePromptProps = {}) {
  const [errorText, setErrorText] = useState('')

  const handleUpgrade = async () => {
    setErrorText('')
    const result = await startGuestGoogleUpgrade(window.location.origin)
    if (!result.ok) {
      setErrorText(result.error)
    }
  }

  return (
    <div className="flex justify-center my-3 md:my-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="max-w-[21.5rem] md:max-w-md w-full border-blue-500/30 bg-blue-500/5 shadow-lg shadow-blue-500/10 backdrop-blur-sm relative">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2.5 right-2.5 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors"
            aria-label="Dismiss upgrade prompt"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <CardHeader className="pb-2 pt-5 text-center">
          <div className="mx-auto bg-blue-500/10 p-2 rounded-full w-10 h-10 flex items-center justify-center mb-2">
            <Rocket className="w-5 h-5 text-blue-500" />
          </div>
          <CardTitle className="text-lg md:text-xl">Guest Limit Reached</CardTitle>
          <CardDescription className="text-sm text-foreground/80">
            Sign up to keep your history and continue chat with BYOK.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-2 pb-4">
          <div className="bg-background/80 rounded-lg p-3 space-y-2 border border-border/50 text-sm">
             <div className="flex items-start gap-3">
               <div className="bg-primary/10 p-1.5 rounded-md shrink-0"><UserPlus className="w-4 h-4 text-primary" /></div>
               <p className="leading-snug"><strong>Create an account</strong> to save memory and continue with unlimited BYOK chat.</p>
             </div>
          </div>
          {errorText && <p className="text-sm text-red-400">{errorText}</p>}
          <div className="pt-1">
            <Button 
                onClick={handleUpgrade}
                className="w-full h-10 font-medium"
            >
              Sign up with Google
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
