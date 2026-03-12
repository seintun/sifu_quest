/**
 * Next.js Edge Middleware — Route Protection
 *
 * All dashboard page routes require a valid next-auth session.
 * Unauthenticated visitors are redirected to /login.
 *
 * API routes are intentionally excluded: they handle auth themselves
 * (returning 401 JSON) and must remain accessible to unauthenticated
 * callers such as internal workers that use a shared secret header.
 */
export { auth as middleware } from "@/auth"

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - /api/**         (all API routes handle auth themselves)
     * - /login          (sign-in page)
     * - /_next/**       (Next.js static/build assets)
     * - /favicon.ico, /manifest.webmanifest, /sitemap.xml, /robots.txt (static metadata)
     * - image files
     */
    '/((?!api|login|_next/static|_next/image|favicon.ico|manifest.webmanifest|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)).*)',
  ],
}
