'use client'

// StrategyBuilder — a dual-mode (text + visual) strategy definition UI.
// The user can type a strategy in plain English OR use dropdown menus to build it visually.
// Both modes stay in sync: typing auto-parses via Claude AI and populates the visual form;
// changing the visual form auto-serializes the conditions back into the text prompt.
// The bidirectional sync is managed by `skipSync.current` to prevent infinite update loops.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import type {
  Direction,
  EntryTiming,
  EntryType,
  ExitType,
  Operator,
  StrategyCondition,
  StrategyConfig,
} from '@/types/backtest'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface IndicatorGroup {
  label: string
  indicators: string[]
}

const INDICATOR_GROUPS: IndicatorGroup[] = [
  { label: 'Momentum', indicators: ['RSI', 'MACD', 'MACD_SIGNAL', 'STOCH_K', 'STOCH_D', 'ADX'] },
  { label: 'Trend', indicators: ['EMA_20', 'EMA_50', 'EMA_200', 'SUPERTREND', 'VWAP'] },
  { label: 'Volatility', indicators: ['ATR', 'BB_WIDTH', 'BB_PCT'] },
  { label: 'Volume', indicators: ['VOLUME_RATIO'] },
  { label: 'Price', indicators: ['CLOSE'] },
  {
    label: 'Candlestick Patterns',
    indicators: [
      'HAMMER', 'SHOOTING_STAR', 'DOJI',
      'BULLISH_ENGULFING', 'BEARISH_ENGULFING',
      'MORNING_STAR', 'EVENING_STAR',
      'INSIDE_BAR', 'OUTSIDE_BAR',
      'THREE_WHITE_SOLDIERS', 'THREE_BLACK_CROWS',
      'BULLISH_PIN_BAR', 'BEARISH_PIN_BAR',
    ],
  },
  {
    label: 'Market Structure',
    indicators: [
      'SWING_HIGH', 'SWING_LOW',
      'BOS_BULLISH', 'BOS_BEARISH',
      'HIGHER_HIGH', 'HIGHER_LOW',
      'LOWER_HIGH', 'LOWER_LOW',
      'UPTREND_STRUCTURE', 'DOWNTREND_STRUCTURE',
    ],
  },
  {
    label: 'Support / Resistance',
    indicators: [
      'NEAR_HORIZONTAL_SUPPORT', 'NEAR_HORIZONTAL_RESISTANCE',
      'NEAR_RESISTANCE_TRENDLINE', 'NEAR_SUPPORT_TRENDLINE',
      'TRENDLINE_BREAKOUT_UP', 'TRENDLINE_BREAKOUT_DOWN',
    ],
  },
  { label: 'Psychological Levels', indicators: ['NEAR_ROUND_NUMBER', 'AT_ROUND_FIVE'] },
]

const ALL_INDICATORS = INDICATOR_GROUPS.flatMap((g) => g.indicators)

// PATTERN_INDICATORS is a Set (not an Array) for O(1) membership lookup.
// These indicators return a binary 0/1 value from the Python service — 1 means the
// pattern was detected on the current bar. They cannot be compared with numeric operators
// like `> 30`, so selecting one auto-sets operator to `==` and value to `1` (see onValueChange below).
const PATTERN_INDICATORS = new Set<string>([
  'HAMMER', 'SHOOTING_STAR', 'DOJI',
  'BULLISH_ENGULFING', 'BEARISH_ENGULFING',
  'MORNING_STAR', 'EVENING_STAR',
  'INSIDE_BAR', 'OUTSIDE_BAR',
  'THREE_WHITE_SOLDIERS', 'THREE_BLACK_CROWS',
  'BULLISH_PIN_BAR', 'BEARISH_PIN_BAR',
  'SWING_HIGH', 'SWING_LOW',
  'BOS_BULLISH', 'BOS_BEARISH',
  'HIGHER_HIGH', 'HIGHER_LOW',
  'LOWER_HIGH', 'LOWER_LOW',
  'UPTREND_STRUCTURE', 'DOWNTREND_STRUCTURE',
  'NEAR_HORIZONTAL_SUPPORT', 'NEAR_HORIZONTAL_RESISTANCE',
  'NEAR_RESISTANCE_TRENDLINE', 'NEAR_SUPPORT_TRENDLINE',
  'TRENDLINE_BREAKOUT_UP', 'TRENDLINE_BREAKOUT_DOWN',
  'NEAR_ROUND_NUMBER', 'AT_ROUND_FIVE',
])

// Helper used in the render to decide whether to show the operator/value selectors
// or just a "pattern detected" badge for the selected indicator.
function isPattern(indicator: string): boolean {
  return PATTERN_INDICATORS.has(indicator)
}

const VALUE_OPERATORS: Operator[] = ['>', '<', '>=', '<=', '==']
const CROSS_OPERATORS: Operator[] = ['crossover', 'crossunder']

const OPERATOR_LABELS: Record<Operator, string> = {
  '>': '> greater than',
  '<': '< less than',
  '>=': '>= at least',
  '<=': '<= at most',
  '==': '== equals',
  crossover: '↑ crosses above',
  crossunder: '↓ crosses below',
}

function isCross(op: string): op is 'crossover' | 'crossunder' {
  return op === 'crossover' || op === 'crossunder'
}

// ---------------------------------------------------------------------------
// Serializer: visual state → plain-English string
// ---------------------------------------------------------------------------

// `serializeToPrompt` converts the current visual StrategyConfig back into a human-readable
// prompt string. This is called every time a visual control changes, keeping the text prompt
// in sync with the visual builder.
// It's also used to initialize the prompt on first render from a pre-existing config
// (e.g. when the user reloads a saved playbook).
function serializeToPrompt(config: StrategyConfig): string {
  if (!config.conditions.length) return ''
  const dir = config.direction === 'long' ? 'Buy' : 'Sell short'
  const parts = config.conditions.map((c) => {
    if (isPattern(c.indicator)) return `${c.indicator} pattern is detected`
    if (c.operator === 'crossover')
      return `${c.indicator} crosses above ${c.target ?? ''}`
    if (c.operator === 'crossunder')
      return `${c.indicator} crosses below ${c.target ?? ''}`
    return `${c.indicator} ${c.operator} ${c.value ?? ''}`
  })
  return `${dir} when ${parts.join(' and ')}. Take profit at ${config.take_profit_r}R, stop loss at ${config.stop_loss_r}R.`
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_CONDITION: StrategyCondition = {
  indicator: 'RSI',
  operator: '<',
  value: 30,
}

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  conditions: [{ ...DEFAULT_CONDITION }],
  take_profit_r: 2,
  stop_loss_r: 1,
  entry_type: 'crossover',
  direction: 'long',
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  value: StrategyConfig
  onChange: (config: StrategyConfig) => void
  /** Controlled prompt text — pass if parent needs to read/save it */
  prompt?: string
  onPromptChange?: (prompt: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StrategyBuilder({ value, onChange, prompt: externalPrompt, onPromptChange }: Props) {
  // `internalPrompt` holds the prompt text when the parent doesn't control it.
  // Initialized from `serializeToPrompt(value)` so the text matches the initial config.
  const [internalPrompt, setInternalPrompt] = useState(() => serializeToPrompt(value))
  // If the parent passes `prompt`, use that (controlled); otherwise use internal state.
  // This is the "uncontrolled with optional controlled override" pattern.
  const prompt = externalPrompt ?? internalPrompt
  const setPrompt = useCallback(
    (text: string) => {
      setInternalPrompt(text)
      onPromptChange?.(text)  // Notify parent if it cares about prompt changes.
    },
    [onPromptChange]
  )

  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | undefined>(undefined)
  // debounceRef holds the pending setTimeout ID for the AI parse trigger.
  // Storing it in a ref (not state) means clearing it doesn't cause a re-render.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // skipSync is a mutable ref flag that breaks the bidirectional sync loop.
  //
  // The sync loop problem:
  //   User changes a visual dropdown → updateVisual() calls onChange(newConfig) → parent
  //   updates `value` prop → the useEffect below fires and would call setPrompt(serialize(value))
  //   → this would overwrite any partial text the user might have typed.
  //
  // The fix:
  //   Before calling onChange() from visual changes, set skipSync.current = true.
  //   The useEffect reads this flag and skips the re-serialization for that one render cycle.
  const skipSync = useRef(false)

  // Sync prompt when `value` changes externally (e.g. AI parse writes back a new config).
  // Skipped when the change originated from a visual control (skipSync.current == true)
  // to prevent the serialized text from overwriting what the user typed.
  useEffect(() => {
    if (skipSync.current) {
      skipSync.current = false
      return
    }
    setPrompt(serializeToPrompt(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // ---------------------------------------------------------------------------
  // Text prompt → AI parse → visual state
  // ---------------------------------------------------------------------------

  // Called on every keystroke in the text prompt textarea.
  // Debounces 900ms before sending to Claude — prevents an API call on every keypress.
  // After 900ms of silence, POSTs to /api/strategy/parse and writes the returned
  // StrategyConfig back to the visual builder via `onChange`.
  const handlePromptChange = useCallback(
    (text: string) => {
      setPrompt(text)
      setParseError(undefined)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      // Don't trigger a parse for very short inputs — not enough info for Claude.
      if (text.trim().length < 15) return

      debounceRef.current = setTimeout(async () => {
        setIsParsing(true)
        try {
          const res = await fetch('/api/strategy/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: text }),
          })
          if (!res.ok) throw new Error('parse failed')
          const config = (await res.json()) as StrategyConfig
          // Set skipSync before calling onChange so the useEffect above doesn't
          // immediately re-serialize the new config back over the text the user typed.
          skipSync.current = true
          onChange(config)
        } catch {
          setParseError('Could not parse strategy — try the visual builder below.')
        } finally {
          setIsParsing(false)
        }
      }, 900)
    },
    [onChange, setPrompt]
  )

  // ---------------------------------------------------------------------------
  // Visual builder → update config + re-serialize prompt
  // ---------------------------------------------------------------------------

  // All visual controls call `updateVisual` instead of calling `onChange` directly.
  // It does three things in sequence:
  // 1. Sets skipSync.current = true to prevent the useEffect from re-serializing.
  // 2. Calls onChange(updated) to notify the parent of the new config.
  // 3. Immediately calls setPrompt(serialize(updated)) to keep the text prompt in sync.
  const updateVisual = useCallback(
    (updated: StrategyConfig) => {
      skipSync.current = true
      onChange(updated)
      setPrompt(serializeToPrompt(updated))
    },
    [onChange, setPrompt]
  )

  const updateCondition = (index: number, patch: Partial<StrategyCondition>) => {
    const conditions = value.conditions.map((c, i) =>
      i === index ? { ...c, ...patch } : c
    )
    updateVisual({ ...value, conditions })
  }

  const addCondition = () =>
    updateVisual({ ...value, conditions: [...value.conditions, { ...DEFAULT_CONDITION }] })

  const removeCondition = (index: number) =>
    updateVisual({ ...value, conditions: value.conditions.filter((_, i) => i !== index) })

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* ── Text prompt ─────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor="strategy-prompt">Strategy Prompt</Label>
          {isParsing && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Parsing…
            </Badge>
          )}
        </div>
        <Textarea
          id="strategy-prompt"
          placeholder='e.g. "Buy when RSI is below 30 and EMA 20 crosses above EMA 50. Take profit 2R, stop 1R."'
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          className="min-h-[76px] resize-none font-mono text-sm"
          aria-label="Plain-English strategy prompt — AI parses this into conditions"
        />
        {parseError && (
          <p className="text-xs text-destructive" role="alert">
            {parseError}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Type a strategy in plain English — AI will populate the builder below.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_196px]">
        {/* ── Conditions ──────────────────────────────────────── */}
        <div className="space-y-3">
          <Label>Entry Conditions</Label>

          {value.conditions.map((cond, i) => (
            <div key={i} className="space-y-1">
              {i > 0 && (
                <p className="text-xs font-medium text-muted-foreground">AND</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {/* Indicator A */}
                <Select
                  value={cond.indicator}
                  onValueChange={(v) => {
                    if (!v) return
                    if (isPattern(v)) {
                      updateCondition(i, { indicator: v, operator: '==', value: 1, target: undefined })
                    } else {
                      updateCondition(i, { indicator: v })
                    }
                  }}
                >
                  <SelectTrigger className="w-44" aria-label={`Condition ${i + 1} indicator`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDICATOR_GROUPS.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.indicators.map((ind) => (
                          <SelectItem key={ind} value={ind}>
                            {ind}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>

                {/* Operator + value/target — hidden for pattern indicators */}
                {isPattern(cond.indicator) ? (
                  <Badge
                    variant="secondary"
                    className="text-xs px-2 py-1"
                    aria-label={`${cond.indicator} pattern detected`}
                  >
                    pattern detected
                  </Badge>
                ) : (
                  <>
                    {/* Operator */}
                    <Select
                      value={cond.operator}
                      onValueChange={(v) => {
                        const op = v as Operator
                        if (isCross(op)) {
                          updateCondition(i, { operator: op, target: 'EMA_50', value: undefined })
                        } else {
                          updateCondition(i, { operator: op, target: undefined, value: cond.value ?? 30 })
                        }
                      }}
                    >
                      <SelectTrigger className="w-40" aria-label={`Condition ${i + 1} operator`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {([...VALUE_OPERATORS, ...CROSS_OPERATORS] as Operator[]).map((op) => (
                          <SelectItem key={op} value={op}>
                            {OPERATOR_LABELS[op]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Value or Target indicator */}
                    {isCross(cond.operator) ? (
                      <Select
                        value={cond.target ?? 'EMA_50'}
                        onValueChange={(v) => v && updateCondition(i, { target: v })}
                      >
                        <SelectTrigger className="w-36" aria-label={`Condition ${i + 1} target indicator`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_INDICATORS.filter((ind) => ind !== cond.indicator && !isPattern(ind)).map((ind) => (
                            <SelectItem key={ind} value={ind}>
                              {ind}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type="number"
                        className="w-24"
                        value={cond.value ?? ''}
                        onChange={(e) =>
                          updateCondition(i, { value: parseFloat(e.target.value) || 0 })
                        }
                        aria-label={`Condition ${i + 1} value`}
                      />
                    )}
                  </>
                )}

                {/* Remove */}
                {value.conditions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCondition(i)}
                    aria-label={`Remove condition ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={addCondition}
            className="mt-1 gap-1"
            aria-label="Add entry condition"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add condition
          </Button>
        </div>

        {/* ── Settings ────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sb-direction">Direction</Label>
            <Select
              value={value.direction ?? 'long'}
              onValueChange={(v) => updateVisual({ ...value, direction: v as Direction })}
            >
              <SelectTrigger id="sb-direction" aria-label="Trade direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="long">Long</SelectItem>
                <SelectItem value="short">Short</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sb-tp">Take Profit (R)</Label>
            <Input
              id="sb-tp"
              type="number"
              step="0.5"
              min="0.5"
              value={value.take_profit_r}
              onChange={(e) =>
                updateVisual({ ...value, take_profit_r: parseFloat(e.target.value) || 2 })
              }
              aria-label="Take profit R multiple"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sb-sl">Stop Loss (R)</Label>
            <Input
              id="sb-sl"
              type="number"
              step="0.5"
              min="0.5"
              value={value.stop_loss_r}
              onChange={(e) =>
                updateVisual({ ...value, stop_loss_r: parseFloat(e.target.value) || 1 })
              }
              aria-label="Stop loss R multiple"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sb-type">Entry Type</Label>
            <Select
              value={value.entry_type ?? 'crossover'}
              onValueChange={(v) => updateVisual({ ...value, entry_type: v as EntryType })}
            >
              <SelectTrigger id="sb-type" aria-label="Entry type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="crossover">Crossover</SelectItem>
                <SelectItem value="breakout">Breakout</SelectItem>
                <SelectItem value="pullback">Pullback</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Execution settings ────────────────────────────── */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Execution
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="sb-timing">Entry Timing</Label>
            <Select
              value={value.entry_timing ?? 'next_open'}
              onValueChange={(v) => v && updateVisual({ ...value, entry_timing: v as EntryTiming })}
            >
              <SelectTrigger id="sb-timing" aria-label="Entry timing">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="next_open">Next Open</SelectItem>
                <SelectItem value="close">Close</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sb-slippage">Slippage (%)</Label>
            <Input
              id="sb-slippage"
              type="number"
              step="0.05"
              min="0"
              max="5"
              value={value.slippage_pct ?? 0}
              onChange={(e) =>
                updateVisual({ ...value, slippage_pct: parseFloat(e.target.value) || 0 })
              }
              aria-label="Slippage percentage"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sb-commission">Commission (R)</Label>
            <Input
              id="sb-commission"
              type="number"
              step="0.001"
              min="0"
              value={value.commission_per_trade ?? 0}
              onChange={(e) =>
                updateVisual({ ...value, commission_per_trade: parseFloat(e.target.value) || 0 })
              }
              aria-label="Commission per trade in R"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sb-exit-type">Exit Type</Label>
            <Select
              value={value.exit_type ?? 'fixed'}
              onValueChange={(v) => v && updateVisual({ ...value, exit_type: v as ExitType })}
            >
              <SelectTrigger id="sb-exit-type" aria-label="Exit type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed R</SelectItem>
                <SelectItem value="trailing_atr">Trailing ATR</SelectItem>
                <SelectItem value="trailing_pct">Trailing %</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {value.exit_type === 'trailing_atr' && (
            <div className="space-y-1.5">
              <Label htmlFor="sb-trail-atr">ATR Multiplier</Label>
              <Input
                id="sb-trail-atr"
                type="number"
                step="0.5"
                min="0.5"
                value={value.trail_atr_multiplier ?? 2}
                onChange={(e) =>
                  updateVisual({
                    ...value,
                    trail_atr_multiplier: parseFloat(e.target.value) || 2,
                  })
                }
                aria-label="ATR trailing stop multiplier"
              />
            </div>
          )}

          {value.exit_type === 'trailing_pct' && (
            <div className="space-y-1.5">
              <Label htmlFor="sb-trail-pct">Trail (%)</Label>
              <Input
                id="sb-trail-pct"
                type="number"
                step="0.5"
                min="0.5"
                value={value.trail_pct ?? 2}
                onChange={(e) =>
                  updateVisual({ ...value, trail_pct: parseFloat(e.target.value) || 2 })
                }
                aria-label="Trailing stop percentage"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
