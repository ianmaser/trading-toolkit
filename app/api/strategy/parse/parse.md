FILE: app/api/strategy/parse/route.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Receives a plain-English trading strategy description from the StrategyBuilder component,
passes it through Claude via the strategyParser service, and returns a structured
StrategyConfig object that the frontend uses to populate the strategy form and run a
backtest. This is what makes the "parse from text" feature work.

HOW IT WORKS (step by step):
1. Auth check — required to prevent unauthenticated Claude API calls (cost + rate limits).
2. The request body is parsed from JSON and validated with Zod. The prompt must be
   10-500 characters — min prevents trivially short inputs, max prevents injection attempts.
3. `parseStrategy` is called with the validated prompt string. Internally it calls
   Claude's `generateObject` with a Zod schema, forcing structured JSON output.
4. On success, the typed `StrategyConfig` is returned as JSON.
5. On failure (Claude validation error, API error), the full error is logged server-side
   and a generic 500 is returned to the client.

KEY CONCEPTS USED:
- **Prompt length as a security boundary**: max(500) prevents adversarial inputs from
  injecting large amounts of text to manipulate Claude's output or exceed token limits.
  min(10) prevents trivially unparseable inputs like "buy".
- **Generic 500 on parser failure**: Claude's validation error messages can be verbose
  and reveal internal schema details. We log the full error server-side for debugging
  but return a safe generic message to the client.

INPUTS AND OUTPUTS:
- POST body: `{ prompt: string }` (10-500 chars)
- Success: 200 `StrategyConfig` object with conditions array and execution settings
- Unauthenticated: 401
- Validation failure: 400
- Claude/parsing failure: 500 `{ error: "Strategy parsing failed" }`

WHAT TO CHECK IF SOMETHING BREAKS:
- 500 on valid-looking prompts: check server logs for `[strategy/parse]` — this will
  show the full Claude validation error or API failure reason.
- Parsed config missing indicators the user mentioned: the indicator may not be listed
  in the SYSTEM_PROMPT in services/strategyParser.ts. Add it there.
- Wrong operator on binary indicators: the SYSTEM_PROMPT rule for `operator == value 1`
  may need clarification for the specific pattern the user is describing.

DEPENDENCIES:
- `@/services/strategyParser` (parseStrategy): Claude-powered strategy parser.
- `@/lib/supabase/server` (createClient): server-side auth.
