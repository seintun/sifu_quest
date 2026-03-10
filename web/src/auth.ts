import { createClient } from "@/lib/supabase"
import { ensureSupabaseUserForGoogle } from "@/lib/auth-identity"
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
