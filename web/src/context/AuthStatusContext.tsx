'use client'

import { createContext, useContext, useMemo } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'

type AccountStatus = {
  userId: string
  isGuest: boolean
  isLinked: boolean
  displayName: string | null
  avatarUrl: string | null
}

type AuthStatusContextValue = {
  accountStatus: AccountStatus | undefined
  isLoading: boolean
  isGuest: boolean
}

const AuthStatusContext = createContext<AuthStatusContextValue>({
  accountStatus: undefined,
  isLoading: true,
  isGuest: false,
})

export function AuthStatusProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useSWR('/api/account/status', fetcher, {
    // Deduplicate with any other calls on the page — SWR uses the key as a cache key
    revalidateOnFocus: false,
  })

  const accountStatus = data?.account as AccountStatus | undefined

  const value = useMemo(
    () => ({
      accountStatus,
      isLoading,
      isGuest: Boolean(accountStatus?.isGuest),
    }),
    [accountStatus, isLoading]
  )

  return <AuthStatusContext.Provider value={value}>{children}</AuthStatusContext.Provider>
}

export function useAuthStatus() {
  return useContext(AuthStatusContext)
}
