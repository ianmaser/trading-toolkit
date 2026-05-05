FILE: services/strategyParser.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Converts a plain-English trading strategy description into a structured `StrategyConfig`
object using Claude as the parser. The user types something like "buy when RSI is below 30
and price breaks above the 20 EMA" and this service returns a machine-readable JSON object
that the Python backtest engine can execute directly.

HOW IT WORKS (step by step):
1. `strategySchema` defines the exact JSON structure Claude must output, using Zod.
   Zod is a schema validation library — it describes types, constraints (min/max,
   enum values, defaults), and required vs optional fields.
2. `generateObject` from the Vercel AI SDK sends the user's prompt to Claude along with
   the SYSTEM_PROMPT and the schema. Unlike `generateText` (which returns a free-form
   string), `generateObject` instructs Claude to output valid JSON matching the schema.
   The SDK validates the output and retries automatically if it doesn't match.
3. The SYSTEM_PROMPT is the core rules engine. It lists every available indicator (by
   category), explains binary vs numeric indicators, defines operator conventions, and
   maps natural language phrases to their indicator names. The accuracy of the parser
   depends almost entirely on how clearly these rules are written.
4. Binary indicators (candlestick patterns, market structure, S/R levels) are a special
   case: they exist in the Python service as 0/1 pandas Series. The condition to check
   them is always `indicator == 1`. The SYSTEM_PROMPT teaches Claude this convention
   explicitly so it never outputs `HAMMER > 0.5` or similar nonsense.
5. The validated object is cast to `StrategyConfig` and returned. Since `generateObject`
   already validated against `strategySchema`, and `strategySchema` mirrors the shape of
   `StrategyConfig`, this cast is safe.

KEY CONCEPTS USED:
- **`generateObject` (Vercel AI SDK)**: Forces Claude to output structured JSON instead
  of free text. The SDK handles schema injection, output parsing, and retry logic.
  This removes the need for any manual JSON.parse or validation on our side.
- **Zod schema as a contract**: The schema simultaneously documents what Claude must
  output and validates that it did so correctly at runtime. `z.enum([...])` means
  Claude cannot invent a new operator; `z.number().default(2)` fills in missing fields
  automatically. `.min(1)` on the conditions array ensures we never get an empty strategy.
- **Binary indicator convention**: All pattern indicators (HAMMER, BOS_BULLISH, etc.)
  are stored in Python as binary pandas Series (0 or 1 per bar). The condition
  `{ indicator: "HAMMER", operator: "==", value: 1 }` means "HAMMER was detected on
  this bar." The SYSTEM_PROMPT teaches Claude this convention explicitly.
- **SYSTEM_PROMPT as a rules engine**: The parser has no traditional if/else logic.
  All mapping logic (e.g. "break of structure" → BOS_BULLISH) lives in the prompt.
  To support a new indicator: add it to the Python service, then add it to the prompt.

INPUTS AND OUTPUTS:
- Input: `prompt` string — the user's natural-language strategy description.
- Output: `Promise<StrategyConfig>` — a validated, typed strategy object ready to POST
  to `/api/backtest`.

WHAT TO CHECK IF SOMETHING BREAKS:
- `generateObject` throwing a validation error: Claude's output didn't match the schema.
  This usually means the prompt contained an indicator name Claude didn't recognise, or
  the model output a field with a type mismatch. Check the raw model output in the error.
- Parser producing wrong indicators: the SYSTEM_PROMPT's natural language mappings may
  be ambiguous or missing. Add or clarify the relevant mapping in SYSTEM_PROMPT.
- New indicator not being used: if you added an indicator to the Python service but
  Claude keeps ignoring it, it's not in SYSTEM_PROMPT. Add it to the appropriate category.
- Known issue (from build hook): the model slug should be 'claude-sonnet-4.6' with a dot.
  Currently using 'claude-sonnet-4-6' with a hyphen — this may need fixing.

DEPENDENCIES:
- `ai` (generateObject): Vercel AI SDK core. Handles structured object generation with
  schema validation and automatic retry.
- `@ai-sdk/anthropic` (anthropic): Anthropic provider adapter for the Vercel AI SDK.
  Translates the SDK's model call into an Anthropic API request.
- `zod` (z): Schema definition and runtime validation library. Used to constrain and
  type-check Claude's JSON output.
