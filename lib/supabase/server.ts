// Supabase has two separate client packages:
//   - @supabase/supabase-js  → for browser use (stores the session in localStorage)
//   - @supabase/ssr          → for server use (stores the session in HTTP cookies)
//
// In Next.js App Router, Server Components and API route handlers run on the server
// and have no access to the browser's localStorage. To keep the user logged in,
// Supabase's session token must travel as an HTTP cookie that both the browser
// and the server can read. This file creates that server-aware client.
import { createServerClient } from '@supabase/ssr'
// `cookies()` is a Next.js server API that gives read/write access to the current
// HTTP request's cookie jar from within Server Components and API route handlers.
import { cookies } from 'next/headers'

// createClient() builds a Supabase client configured to read and write auth tokens
// via Next.js cookies rather than localStorage.
//
// It is `async` because `cookies()` in Next.js 15+ returns a Promise — the cookie
// store is resolved asynchronously from the incoming request context.
export async function createClient() {
  const cookieStore = await cookies()

  // createServerClient wires Supabase's auth layer to our custom cookie adapter.
  // We provide two callback functions so Supabase can transparently manage sessions:
  //   - getAll: called by Supabase to read existing auth tokens from the request
  //   - setAll: called by Supabase to write refreshed tokens back to the response
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Hand all current cookies to Supabase so it can find the session token
        // (typically named "sb-<project>-auth-token").
        getAll() {
          return cookieStore.getAll()
        },

        // When Supabase refreshes an expired access token, it calls setAll to
        // persist the new token. The try/catch is intentional:
        //
        // Server Components in Next.js are READ-ONLY — they render HTML and cannot
        // write to the response (including setting cookies). If setAll is called
        // from a Server Component context, the `.set()` call throws. We catch and
        // ignore it because Next.js Middleware handles the actual token refresh and
        // cookie write on the next request. Route Handlers and Server Actions DO
        // allow cookie writes and will succeed here without hitting the catch.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Intentionally empty — see comment above.
          }
        },
      },
    }
  )
}
