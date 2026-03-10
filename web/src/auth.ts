import { createClient } from "@/lib/supabase"
import { randomBytes } from "crypto"
import { readFileSync, writeFileSync } from "fs"
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { join } from "path"

// Auto-generate AUTH_SECRET if missing — writes to .env.local so it persists
function getOrCreateSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET

  const secret = randomBytes(32).toString('base64')
  process.env.AUTH_SECRET = secret

  const envPath = join(process.cwd(), '.env.local')
  try {
    const existing = readFileSync(envPath, 'utf-8')
    if (!existing.includes('AUTH_SECRET=')) {
      writeFileSync(envPath, existing.trimEnd() + `\nAUTH_SECRET=${secret}\n`, 'utf-8')
    }
  } catch {
    writeFileSync(envPath, `AUTH_SECRET=${secret}\n`, 'utf-8')
  }

  return secret
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: getOrCreateSecret(),
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
    async jwt({ token, user }) {
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
