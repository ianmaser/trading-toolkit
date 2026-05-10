// Next.js Route Handler — GET /auth/callback
//
// This route completes Supabase's PKCE (Proof Key for Code Exchange) OAuth flow.
// Here's how the full auth sequence works:
//
//   1. User clicks "Sign in with Google" (or email magic link) on the login page.
//   2. Supabase redirects the user to the OAuth provider (Google, GitHub, etc.).
//   3. After the user authenticates, the provider redirects back to THIS route
//      with a one-time `code` parameter in the URL query string.
//   4. This route exchanges that code for a real session (JWT access token +
//      refresh token) by calling `exchangeCodeForSession`.
//   5. Supabase writes the session as an HTTP cookie via the server client's
//      cookie adapter (see lib/supabase/server.ts).
//   6. The user is redirected to their destination with the session cookie set.
//
// PKCE is a security protocol that prevents the auth code from being stolen
// in transit — the one-time code is useless without the secret that was generated
// client-side at the start of the flow.
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  // The one-time authorization code sent back by the OAuth provider or Supabase.
  const code = searchParams.get('code')

  // `next` allows post-login deep linking. If the user was trying to access
  // /dashboard/ticker/AAPL before being redirected to login, that path is
  // preserved here so they land in the right place after authenticating.
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    // `exchangeCodeForSession` sends the code to Supabase's auth server,
    // which validates it and returns a session. The session JWT is then
    // written to an HTTP cookie by the server client's `setAll` callback.
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If no code was provided, or the exchange failed, redirect back to login
  // with an error flag so the UI can display an appropriate message.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
