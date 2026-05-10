FILE: app/auth/callback/route.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Completes the OAuth / magic-link login flow for Supabase. After the user authenticates with
Google (or any provider), the provider redirects back to this URL with a one-time code.
This route exchanges that code for a real session cookie, then forwards the user to their
destination. Without this step, Supabase's PKCE auth flow cannot complete.

HOW IT WORKS (step by step):
1. The browser hits GET /auth/callback?code=<one-time-code>&next=/dashboard/...
2. The route reads the `code` query parameter — this is the authorization code sent back
   by the OAuth provider or Supabase after the user successfully signed in.
3. It also reads the optional `next` parameter. If the user was trying to reach a specific
   page before being redirected to login (e.g. /dashboard/ticker/AAPL), that path was
   encoded into the redirect URL so they land in the right place after auth.
4. `createClient()` creates a server-side Supabase client (see lib/supabase/server.ts).
   This client can write session cookies, which the browser Supabase client cannot do from
   the server.
5. `exchangeCodeForSession(code)` sends the one-time code to Supabase's auth server.
   Supabase validates it, generates a JWT access token + refresh token, and the server
   client writes them as HTTP cookies via its cookie adapter.
6. On success, the user is redirected to `${origin}${next}` — their intended destination.
7. If no code was present or the exchange failed (expired code, network error), the user is
   redirected back to /login with `?error=auth_callback_failed` so the UI can show a message.

KEY CONCEPTS USED:
- **PKCE (Proof Key for Code Exchange)**: A security extension to OAuth that prevents the
  auth code from being stolen in transit. The client generates a secret at the start of the
  flow; only a request that knows that secret can exchange the code for a session. This is
  why the code is useless if intercepted — it must be paired with the original secret.
- **One-time authorization code**: The `code` in the URL is valid for a single exchange only.
  Once `exchangeCodeForSession` consumes it, it cannot be reused. This prevents replay attacks.
- **Server-side cookie write**: The session JWT is written as an HTTP cookie (not localStorage)
  so it's available to Next.js Server Components and API Route Handlers on every request.
  The browser Supabase client cannot write cookies from the server side — that's why this
  dedicated server route handles the exchange.
- **`next` deep-link parameter**: Encodes the user's intended destination before they were
  redirected to login. The login page appends it to the redirect URL, and this route reads
  it back to forward the user to the right place after auth.

INPUTS AND OUTPUTS:
- GET request with query params: `?code=<string>&next=<optional-path>`
- Success: HTTP 302 redirect to `${origin}${next}` (default: /dashboard) with session cookie set
- Failure (no code or exchange error): HTTP 302 redirect to /login?error=auth_callback_failed

WHAT TO CHECK IF SOMETHING BREAKS:
- Redirect loop (keeps landing back on login): `exchangeCodeForSession` failed. Check server
  logs for the Supabase error. Common causes: expired code (user took too long), misconfigured
  redirect URL in Supabase dashboard, or `SUPABASE_URL`/`SUPABASE_ANON_KEY` env vars missing.
- "auth_callback_failed" error on login page: the code was either absent or already consumed.
  If this happens consistently, check that the Supabase Auth Redirect URL list includes this
  route's full URL (e.g., https://yourdomain.com/auth/callback).
- User lands on /dashboard instead of their intended page: the `next` parameter was not
  passed through the login redirect. Check that the login page appends `?next=<path>` to
  the Supabase `redirectTo` option when initiating OAuth.

DEPENDENCIES:
- `@/lib/supabase/server` (createClient): server-side Supabase client with cookie write access.
- `next/server` (NextResponse, NextRequest): Next.js server utilities for reading the request
  URL and constructing redirect responses.
