'use client'

import { Button } from "@/components/ui/button"
import { User } from "lucide-react"
import { signIn } from "next-auth/react"
import { useState } from "react"

export function AuthForm() {
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false)
  const [isLoadingGuest, setIsLoadingGuest] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsLoadingGoogle(true)
    try {
      await signIn('google', { callbackUrl: '/' })
    } catch (error) {
      console.error(error)
      setIsLoadingGoogle(false)
    }
  }

  const handleGuestSignIn = async () => {
    setIsLoadingGuest(true)
    try {
      await signIn('anonymous', { callbackUrl: '/' })
    } catch (error) {
      console.error(error)
      setIsLoadingGuest(false)
    }
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <Button 
        variant="outline" 
        className="w-full h-11 sm:h-12 text-sm relative group overflow-hidden border-border bg-transparent hover:bg-surface transition-all"
        onClick={handleGoogleSignIn}
        disabled={isLoadingGoogle || isLoadingGuest}
      >
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-coach to-transparent translate-y-full group-hover:translate-y-0 transition-transform" />
        {isLoadingGoogle ? (
          <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
        ) : (
          <>
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-3" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </>
        )}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-surface px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      <Button 
        variant="secondary" 
        className="w-full h-11 sm:h-12 text-sm group hover:bg-elevated text-foreground"
        onClick={handleGuestSignIn}
        disabled={isLoadingGoogle || isLoadingGuest}
      >
        {isLoadingGuest ? (
          <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
        ) : (
          <>
            <User className="w-4 h-4 sm:w-5 sm:h-5 mr-3 text-muted-foreground group-hover:text-foreground transition-colors" />
            Sign in as Guest
          </>
        )}
      </Button>
    </div>
  )
}
