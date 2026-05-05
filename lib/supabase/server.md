FILE: lib/supabase/server.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Exports a single async factory function, `createClient()`, that builds a Supabase
database/auth client configured for server-side use in Next.js. Unlike the browser
client (lib/supabase/client.ts), this one reads and writes the user's auth session
from HTTP cookies rather than localStorage, which is the only mechanism available
in Server Components, API route handlers, and Server Actions.

HOW IT WORKS (step by step):
1. `cookies()` is called from `next/headers` — a Next.js built-in that exposes the
   current HTTP request's cookie jar to server-side code. It returns a Promise in
   Next.js 15+, so `createClient` must be `async` and `await` it.
2. `createServerClient` (from `@supabase/ssr`) creates a Supabase client and wires
   it to a custom cookie adapter — two functions that tell Supabase how to read and
   write auth tokens in this environment.
3. `getAll()` is called by Supabase whenever it needs to find the current session.
   It returns every cookie on the request so Supabase can locate its auth token
   (typically named `sb-<project-ref>-auth-token`).
4. `setAll()` is called by Supabase when it refreshes an expired access token and
   needs to persist the new token. It iterates the list of cookies to set and writes
   each one via `cookieStore.set()`.
5. The `try/catch` in `setAll` is intentional and required:
   - Server Components (the RSC layer) are read-only. They render HTML but cannot
     write to the HTTP response, including setting cookies. Calling `.set()` there
     throws an error.
   - We catch and swallow that error because Next.js Middleware is responsible for
     refreshing tokens and writing cookies before Server Components even run.
   - Route Handlers and Server Actions CAN write cookies — `.set()` succeeds there
     without hitting the catch.

KEY CONCEPTS USED:
- **`@supabase/ssr`**: Supabase's SSR-specific package. The regular
  `@supabase/supabase-js` client assumes a browser environment and uses localStorage.
  This package instead accepts a custom cookie adapter, making it work anywhere.
- **Next.js `cookies()` API**: A server-only Next.js function that provides typed
  access to request cookies. Must be awaited in Next.js 15+. Calling it in a Client
  Component will throw.
- **Cookie-based auth**: Supabase stores a JWT access token and a refresh token. On
  the server, these travel as HttpOnly cookies so they're invisible to client-side
  JavaScript, which is a security improvement over localStorage.
- **Server Component read-only constraint**: Next.js intentionally prevents Server
  Components from mutating the response (headers, cookies) to keep rendering
  predictable and cacheable. Only Route Handlers, Server Actions, and Middleware can
  mutate the response.

INPUTS AND OUTPUTS:
- Inputs: none — reads Supabase URL and anon key from env vars, reads cookies from
  the current Next.js request context automatically.
- Outputs: a fully configured `SupabaseClient` instance that can query the database
  and call auth APIs with the current user's session attached.

WHAT TO CHECK IF SOMETHING BREAKS:
- `cookies()` throwing "cookies was called outside a request scope": this function is
  being called at module level or in a context without an active request (e.g. during
  build). Always call `createClient()` inside a request handler, not at the top level.
- User appears logged out on the server but logged in on the client: the auth cookie
  is likely not being set or forwarded. Check that Middleware is running and calling
  `supabase.auth.getSession()` to refresh tokens on each request.
- TypeScript errors from `createServerClient`: ensure `@supabase/ssr` is installed
  and not confused with `@supabase/supabase-js` types.

DEPENDENCIES:
- `@supabase/ssr` (createServerClient): Supabase client factory designed for
  server-side rendering contexts. Accepts a cookie adapter instead of using localStorage.
- `next/headers` (cookies): Next.js built-in for reading/writing HTTP cookies in
  server-side code. Only available in server contexts (not Client Components).
