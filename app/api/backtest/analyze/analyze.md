FILE: app/api/backtest/analyze/route.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Streams BULL-E's analysis of a completed backtest result back to the browser using the
Vercel AI SDK's streaming response. Unlike standard JSON routes that wait for a complete
response, this route sends Claude's text token-by-token as it's generated — so the UI
can display the analysis appearing word-by-word rather than after a multi-second wait.

HOW IT WORKS (step by step):
1. Auth check — same pattern as all protected routes.
2. The request body contains the full `BacktestResult`. It's validated as `z.unknown()`
   (accepts anything) and then cast to `BacktestResult` — we trust our own data shape.
3. `regime_breakdown` is serialised into a readable multi-line string before being
   embedded in the prompt. Claude gets plain text, not raw JSON objects.
4. `streamText` calls Claude with the assembled prompt and immediately returns a stream
   object — it does NOT await Claude's full response.
5. `.toTextStreamResponse()` converts the stream into an HTTP Response with streaming
   headers. The browser receives tokens progressively as Claude produces them.

KEY CONCEPTS USED:
- **`streamText` vs `generateObject`**: `generateObject` waits for the complete response
  then validates JSON. `streamText` sends tokens immediately as they arrive. For analysis
  text that could be 4 paragraphs, streaming reduces perceived latency from ~5s blank
  wait to immediate text appearance.
- **Server-Sent Events / streaming HTTP**: `.toTextStreamResponse()` sets the response
  headers for streaming (Content-Type: text/plain; Transfer-Encoding: chunked). The
  browser keeps the connection open and reads chunks as they arrive.
- **`z.unknown()` cast**: The backtest result is a complex nested type. Re-validating
  every field with a full Zod schema would duplicate the Python service's validation.
  Since this data came directly from our own `/api/backtest` route, the cast is safe.
- **Prompt-assembled context**: `regimeText` converts the structured regime_breakdown
  object into a readable summary line by line. This is cleaner than embedding raw JSON
  in the prompt, which Claude handles less reliably.

INPUTS AND OUTPUTS:
- POST body: `{ results: BacktestResult }`
- Success: streaming text response (chunks of BULL-E's analysis)
- Unauthenticated: 401 plain text
- Validation failure: 400 plain text

WHAT TO CHECK IF SOMETHING BREAKS:
- Stream starts but cuts off mid-response: Claude hit a token limit or the Anthropic API
  returned an error mid-stream. Check server logs for the full error.
- UI shows no text appearing: the component may not be reading the stream correctly.
  The AI SDK's `useCompletion` hook handles streaming automatically on the client side.
- `regime_breakdown` showing as empty in BULL-E's analysis: check that the Python service
  is returning `regime_breakdown` in the BacktestResult. This was a known bug (stray
  `ta.adx()` calls) that was fixed in the 5-5-2026 price action session.

DEPENDENCIES:
- `ai` (streamText): Vercel AI SDK for streaming text generation.
- `@ai-sdk/anthropic` (anthropic): Anthropic provider for the AI SDK.
- `@/lib/supabase/server` (createClient): server-side auth.
