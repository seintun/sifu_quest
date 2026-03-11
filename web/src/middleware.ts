/**
 * Next.js Edge Middleware — Route Protection
 *
 * All dashboard routes require a valid next-auth session.
 * Unauthenticated visitors (no session cookie) are redirected to /login.
 *
 * Public routes (login, API auth callbacks, static assets) are always allowed through.
 */
export { auth as middleware } from "@/auth"

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - /login          (sign-in page)
     * - /api/auth/**    (next-auth internal callbacks)
     * - /_next/**       (Next.js static/build assets)
     * - /favicon.ico, /sitemap.xml, /robots.txt (static metadata)
     * - image files
     */
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)).*)',
  ],
}
