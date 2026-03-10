'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { startGuestGoogleUpgrade } from '@/lib/guest-upgrade'
import { KeyRound, Rocket, UserPlus } from 'lucide-react'
import { useState } from 'react'

export function UpgradePrompt() {
  const [errorText, setErrorText] = useState('')

  const handleUpgrade = async () => {
    setErrorText('')
    const result = await startGuestGoogleUpgrade(window.location.origin)
    if (!result.ok) {
      setErrorText(result.error)
    }
  }

  return (
    <div className="flex justify-center my-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="max-w-md w-full border-blue-500/30 bg-blue-500/5 shadow-lg shadow-blue-500/10 backdrop-blur-sm">
        <CardHeader className="pb-3 text-center">
          <div className="mx-auto bg-blue-500/10 p-3 rounded-full w-14 h-14 flex items-center justify-center mb-2">
            <Rocket className="w-8 h-8 text-blue-500" />
          </div>
          <CardTitle className="text-xl">You&apos;ve Reached the Guest Limit</CardTitle>
          <CardDescription className="text-foreground/80">
            Guest sessions provide a 30-minute test flight with 5 free messages using our API key. 
            To continue this session securely, please create a free account and bring your own Anthropic API key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="bg-background/80 rounded-lg p-4 space-y-3 border border-border/50 text-sm">
             <div className="flex items-start gap-3">
               <div className="bg-primary/10 p-1.5 rounded-md shrink-0"><UserPlus className="w-4 h-4 text-primary" /></div>
               <p className="leading-snug"><strong>Create an Account:</strong> Your memory files and history will be permanently saved.</p>
             </div>
             <div className="flex items-start gap-3">
               <div className="bg-primary/10 p-1.5 rounded-md shrink-0"><KeyRound className="w-4 h-4 text-primary" /></div>
               <p className="leading-snug"><strong>Secure Keys:</strong> Supply your own API key which is AES-256 encrypted at rest.</p>
             </div>
          </div>
          {errorText && <p className="text-sm text-red-400">{errorText}</p>}
          <div className="pt-2">
            <Button 
                onClick={handleUpgrade}
                className="w-full font-medium"
            >
              Sign up with Google
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
