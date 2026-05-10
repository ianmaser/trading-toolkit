FILE: app/api/backtest/route.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
The most security-critical route in the app. It authenticates the user, validates the
full strategy config, then acts as a secure proxy — forwarding the validated request to
the Python FastAPI backtest engine on Railway and streaming the result back. The Python
service URL is never exposed to the browser; only this server-side route knows it.

HOW IT WORKS (step by step):
1. Auth check runs first — before parsing the body. `supabase.auth.getUser()` verifies
   the session JWT server-side. This cannot be spoofed by the client.
2. The request body is parsed from JSON. If the body isn't valid JSON, a 400 is returned
   before Zod even runs — prevents crashes on malformed requests.
3. Zod validates the full nested structure: outer params (symbol, timeframe, dates) plus
   the nested `strategy_config` with all its conditions and execution settings.
4. `PYTHON_SERVICE_URL` is checked. In local dev without Railway, this returns 503
   cleanly rather than an unhandled fetch error.
5. The validated `parsed.data` (not the raw body) is forwarded to Python. This ensures
   all Zod defaults (slippage_pct=0, etc.) are applied before the Python service sees it.
6. Python errors are forwarded to the client with their original status code. FastAPI
   uses `{ "detail": "..." }` for error messages — we extract and re-wrap as `{ error }`.

KEY CONCEPTS USED:
- **Auth before body parse**: A deliberate ordering. Unauthenticated requests are
  rejected immediately without wasting time parsing or validating the body.
- **Proxy pattern**: This route acts as a pass-through. It doesn't compute the backtest
  itself — it validates, then forwards to the Python service that does the real work.
  The proxy exists to keep the Python URL private and to enforce auth/validation.
- **Forwarding `parsed.data` not raw body**: Zod applies `.default()` values during
  parsing. If we forwarded the raw body, optional fields with defaults would be missing.
- **FastAPI `detail` field**: Python's FastAPI framework returns HTTP errors as
  `{ "detail": "message" }`. We read this and forward it as `{ "error": "message" }`
  to match our API's consistent error shape.
- **503 for network errors**: `fetch()` throws (doesn't return a Response) when the
  target server is unreachable. The catch block handles this, returning 503.

INPUTS AND OUTPUTS:
- POST body: `{ symbol, timeframe, date_from, date_to, strategy_config: { conditions, ... } }`
- Success: 200 `BacktestResult` JSON
- Unauthenticated: 401
- Validation failure: 400
- Python service down: 503
- Python error: forwarded status + `{ error: string }`

WHAT TO CHECK IF SOMETHING BREAKS:
- 401 on valid requests: session cookie expired or middleware not refreshing tokens.
- 503 "Python service unreachable": Railway deployment is cold-starting (first request
  after inactivity can take 10-20s) or `PYTHON_SERVICE_URL` env var is wrong.
- 503 "Python service not configured": `PYTHON_SERVICE_URL` is not set in `.env.local`.
- 400 with field errors: check that `take_profit_r` and `stop_loss_r` are positive
  numbers and that conditions array has at least one entry.

DEPENDENCIES:
- `@/lib/supabase/server` (createClient): server-side auth verification.
- Python FastAPI service on Railway (via PYTHON_SERVICE_URL env var).
