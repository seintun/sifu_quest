import { createClient } from "@/lib/supabase"
import { createAdminClient } from "@/lib/supabase-admin"
import { assertRequiredEnv, getAuthSecret } from "@/lib/env"
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"

assertRequiredEnv([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
])

type OAuthUserSeed = {
  email: string
  name?: string | null
  image?: string | null
}

async function findSupabaseUserByEmail(email: string): Promise<string | null> {
  const supabaseAdmin = createAdminClient()
  const normalizedEmail = email.trim().toLowerCase()
  const perPage = 200
  let page = 1

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(`Failed to list Supabase users: ${error.message}`)
    }

    const users = data?.users ?? []
    const match = users.find((u) => u.email?.toLowerCase() === normalizedEmail)
    if (match) {
      return match.id
    }

    if (users.length < perPage) {
      return null
    }
    page += 1
  }
}

async function ensureSupabaseUserForGoogle(user: OAuthUserSeed): Promise<string> {
  const supabaseAdmin = createAdminClient()
  const existingId = await findSupabaseUserByEmail(user.email)
  if (existingId) {
    return existingId
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: user.email.trim().toLowerCase(),
    email_confirm: true,
    user_metadata: {
      name: user.name ?? null,
      avatar_url: user.image ?? null,
      provider: 'google',
    },
  })

  if (error || !data.user) {
    throw new Error(`Failed to create Supabase user for Google login: ${error?.message ?? 'unknown error'}`)
  }

  return data.user.id
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: getAuthSecret(),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      id: "anonymous",
      name: "Anonymous",
      credentials: {},
      async authorize() {
        // Sign in anonymously via Supabase
        const supabase = await createClient()
        const { data, error } = await supabase.auth.signInAnonymously()
        
        if (error || !data.user) {
          console.error("Anonymous sign-in failed:", error)
          return null
        }
        
        return {
          id: data.user.id,
          name: "Guest",
          email: `guest-${data.user.id.substring(0,8)}@anonymous.local`
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === 'google' && user) {
        if (!user.email) {
          throw new Error('Google account did not return an email address.')
        }

        token.id = await ensureSupabaseUserForGoogle({
          email: user.email,
          name: user.name,
          image: user.image,
        })
        return token
      }

      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    }
  },
  pages: {
    signIn: '/login'
  }
})
