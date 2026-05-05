'use client'

import { useCallback, useRef, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  DEFAULT_STRATEGY_CONFIG,
  StrategyBuilder,
} from '@/components/features/StrategyBuilder'
import { useRunBacktest, useSavePlaybook } from '@/hooks/useBacktest'
import type { BacktestResult, StrategyConfig } from '@/types/backtest'
import type { Timeframe as MarketTimeframe } from '@/types/market'
import { ArrowLeft, BookmarkPlus, Bot, Layers, Loader2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageState = 'input' | 'loading' | 'results'

interface MultiResult {
  symbol: string
  result?: BacktestResult
  error?: string
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: 'good' | 'bad' | 'neutral'
}) {
  const color =
    highlight === 'good'
      ? 'text-green-500'
      : highlight === 'bad'
        ? 'text-red-500'
        : 'text-foreground'
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BacktestPage() {
  // ── Config state ──────────────────────────────────────────────────────────
  const [config, setConfig] = useState<StrategyConfig>(DEFAULT_STRATEGY_CONFIG)
  const [prompt, setPrompt] = useState('')
  const [symbol, setSymbol] = useState('SPY')
  const [timeframe, setTimeframe] = useState<MarketTimeframe>('1D')
  const [dateFrom, setDateFrom] = useState('2022-01-01')
  const [dateTo, setDateTo] = useState('2024-12-31')

  // ── Page state ────────────────────────────────────────────────────────────
  const [pageState, setPageState] = useState<PageState>('input')
  const [result, setResult] = useState<BacktestResult | null>(null)

  // ── Mutations ─────────────────────────────────────────────────────────────
  const runBacktest = useRunBacktest()
  const savePlaybook = useSavePlaybook()

  // ── BULL-E streaming analysis ─────────────────────────────────────────────
  const [analysis, setAnalysis] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const streamAnalysis = useCallback(async (res: BacktestResult) => {
    setIsAnalyzing(true)
    setAnalysis('')
    try {
      const response = await fetch('/api/backtest/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: res }),
      })
      if (!response.ok || !response.body) return
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setAnalysis((prev) => prev + decoder.decode(value, { stream: true }))
      }
    } catch {
      // analysis is optional — fail silently
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  // ── Save modal ────────────────────────────────────────────────────────────
  const [saveOpen, setSaveOpen] = useState(false)
  const [playbookName, setPlaybookName] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ── Multi-ticker modal ────────────────────────────────────────────────────
  const [multiOpen, setMultiOpen] = useState(false)
  const [multiSymbols, setMultiSymbols] = useState('')
  const [multiResults, setMultiResults] = useState<MultiResult[]>([])
  const [isRunningMulti, setIsRunningMulti] = useState(false)

  // ── Run backtest ──────────────────────────────────────────────────────────
  async function handleRun() {
    setPageState('loading')
    setResult(null)
    setAnalysis('')
    try {
      const res = await runBacktest.mutateAsync({
        symbol: symbol.toUpperCase(),
        timeframe,
        date_from: dateFrom,
        date_to: dateTo,
        strategy_config: config,
      })
      setResult(res)
      setPageState('results')
      void streamAnalysis(res)
    } catch (err) {
      setPageState('input')
      // Error surfaced via runBacktest.error
    }
  }

  // ── Save playbook ─────────────────────────────────────────────────────────
  async function handleSave() {
    if (!result || !playbookName.trim()) return
    await savePlaybook.mutateAsync({
      name: playbookName.trim(),
      prompt,
      config,
      results: result,
    })
    setSaveSuccess(true)
    setTimeout(() => {
      setSaveOpen(false)
      setSaveSuccess(false)
      setPlaybookName('')
    }, 1500)
  }

  // ── Run on more tickers ───────────────────────────────────────────────────
  async function handleMultiRun() {
    const symbols = multiSymbols
      .split(/[\n,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
    if (!symbols.length) return

    setIsRunningMulti(true)
    setMultiResults([])

    for (const sym of symbols) {
      try {
        const res = await fetch('/api/backtest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: sym,
            timeframe,
            date_from: dateFrom,
            date_to: dateTo,
            strategy_config: config,
          }),
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          setMultiResults((prev) => [...prev, { symbol: sym, error: err.error ?? 'Failed' }])
        } else {
          const r = (await res.json()) as BacktestResult
          setMultiResults((prev) => [...prev, { symbol: sym, result: r }])
        }
      } catch {
        setMultiResults((prev) => [...prev, { symbol: sym, error: 'Network error' }])
      }
    }
    setIsRunningMulti(false)
  }

  // ---------------------------------------------------------------------------
  // INPUT STATE
  // ---------------------------------------------------------------------------

  if (pageState === 'input') {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold">Backtest Lab</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define a strategy and test it against historical data.
          </p>
        </div>

        {/* Strategy builder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <StrategyBuilder
              value={config}
              onChange={setConfig}
              prompt={prompt}
              onPromptChange={setPrompt}
            />
          </CardContent>
        </Card>

        {/* Run parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="bt-symbol">Symbol</Label>
                <Input
                  id="bt-symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="SPY"
                  aria-label="Ticker symbol"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bt-timeframe">Timeframe</Label>
                <Select
                  value={timeframe}
                  onValueChange={(v) => setTimeframe(v as MarketTimeframe)}
                >
                  <SelectTrigger id="bt-timeframe" aria-label="Timeframe">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['1D', '4H', '1H', '15M', '5M'] as MarketTimeframe[]).map((tf) => (
                      <SelectItem key={tf} value={tf}>
                        {tf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bt-from">From</Label>
                <Input
                  id="bt-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="Start date"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bt-to">To</Label>
                <Input
                  id="bt-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label="End date"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {runBacktest.error && (
          <p className="text-sm text-destructive" role="alert">
            {(runBacktest.error as Error).message}
          </p>
        )}

        <Button
          onClick={handleRun}
          disabled={!symbol || !dateFrom || !dateTo || config.conditions.length === 0}
          className="w-full sm:w-auto"
          aria-label="Run backtest"
        >
          Run Backtest
        </Button>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // LOADING STATE
  // ---------------------------------------------------------------------------

  if (pageState === 'loading') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Running backtest on{' '}
          <span className="font-semibold text-foreground">{symbol.toUpperCase()}</span>…
        </p>
        <div className="w-64 space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RESULTS STATE
  // ---------------------------------------------------------------------------

  if (!result) return null

  const equityCurveData = result.equity_curve.map((v, i) => ({ trade: i, value: v }))

  const winRateHighlight =
    result.win_rate >= 0.55 ? 'good' : result.win_rate <= 0.4 ? 'bad' : 'neutral'
  const expectancyHighlight =
    result.expectancy > 0.2 ? 'good' : result.expectancy < 0 ? 'bad' : 'neutral'

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPageState('input')}
            aria-label="Back to editor"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold">
              {result.symbol} · {result.timeframe}
            </h1>
            <p className="text-xs text-muted-foreground">
              {result.date_from} → {result.date_to}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMultiOpen(true)}
            aria-label="Run on more tickers"
          >
            <Layers className="mr-1.5 h-4 w-4" aria-hidden="true" />
            More Tickers
          </Button>
          <Button
            size="sm"
            onClick={() => setSaveOpen(true)}
            aria-label="Save as playbook"
          >
            <BookmarkPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Save as Playbook
          </Button>
        </div>
      </div>

      {/* Stats — row 1 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Trades" value={String(result.total_trades)} />
        <StatCard
          label="Win Rate"
          value={`${(result.win_rate * 100).toFixed(1)}%`}
          highlight={winRateHighlight}
        />
        <StatCard
          label="Expectancy"
          value={`${result.expectancy.toFixed(2)}R`}
          sub="per trade"
          highlight={expectancyHighlight}
        />
        <StatCard
          label="Profit Factor"
          value={result.profit_factor != null ? result.profit_factor.toFixed(2) : '—'}
          highlight={
            result.profit_factor == null
              ? 'neutral'
              : result.profit_factor >= 1.5
                ? 'good'
                : result.profit_factor < 1
                  ? 'bad'
                  : 'neutral'
          }
        />
        <StatCard
          label="Max Drawdown"
          value={`${result.max_drawdown.toFixed(2)}R`}
          highlight={result.max_drawdown > 5 ? 'bad' : 'neutral'}
        />
      </div>

      {/* Stats — row 2 (10b) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard
          label="Avg Win"
          value={result.avg_win_r != null ? `+${result.avg_win_r.toFixed(2)}R` : '—'}
          highlight="good"
        />
        <StatCard
          label="Avg Loss"
          value={result.avg_loss_r != null ? `${result.avg_loss_r.toFixed(2)}R` : '—'}
          highlight="bad"
        />
        <StatCard
          label="Largest Win"
          value={result.largest_win_r != null ? `+${result.largest_win_r.toFixed(2)}R` : '—'}
          highlight="good"
        />
        <StatCard
          label="Largest Loss"
          value={result.largest_loss_r != null ? `${result.largest_loss_r.toFixed(2)}R` : '—'}
          highlight="bad"
        />
        <StatCard
          label="Win Streak"
          value={String(result.max_consecutive_wins)}
          highlight={result.max_consecutive_wins >= 5 ? 'good' : 'neutral'}
        />
        <StatCard
          label="Loss Streak"
          value={String(result.max_consecutive_losses)}
          highlight={result.max_consecutive_losses >= 5 ? 'bad' : 'neutral'}
        />
        <StatCard
          label="Sharpe"
          value={result.sharpe_ratio != null ? result.sharpe_ratio.toFixed(2) : '—'}
          sub="annualized"
          highlight={
            result.sharpe_ratio == null
              ? 'neutral'
              : result.sharpe_ratio >= 1
                ? 'good'
                : result.sharpe_ratio < 0
                  ? 'bad'
                  : 'neutral'
          }
        />
        <StatCard
          label="Exp / Bar"
          value={result.expectancy_per_bar != null ? `${result.expectancy_per_bar.toFixed(4)}R` : '—'}
          sub="efficiency"
          highlight={
            result.expectancy_per_bar == null
              ? 'neutral'
              : result.expectancy_per_bar > 0
                ? 'good'
                : 'bad'
          }
        />
      </div>

      {/* Equity curve */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equity Curve (cumulative R)</CardTitle>
        </CardHeader>
        <CardContent>
          {equityCurveData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={equityCurveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="trade"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Trade #', position: 'insideBottomRight', offset: -8, fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: unknown) => [
                    typeof v === 'number' ? `${v.toFixed(2)}R` : '—',
                    'Cumulative R',
                  ]}
                  labelFormatter={(l: unknown) =>
                    typeof l === 'number' ? `Trade ${l}` : ''
                  }
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No trades executed — conditions may be too restrictive.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Regime breakdown */}
      {Object.keys(result.regime_breakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Regime Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-6 font-medium">Regime</th>
                    <th className="pb-2 pr-6 font-medium">Trades</th>
                    <th className="pb-2 pr-6 font-medium">Win Rate</th>
                    <th className="pb-2 font-medium">Expectancy</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.regime_breakdown).map(([regime, stats]) => (
                    <tr key={regime} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-6 capitalize">{regime}</td>
                      <td className="py-2 pr-6 tabular-nums">{stats.total_trades}</td>
                      <td className="py-2 pr-6 tabular-nums">
                        {(stats.win_rate * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 tabular-nums">
                        <span
                          className={
                            stats.expectancy > 0 ? 'text-green-500' : 'text-red-500'
                          }
                        >
                          {stats.expectancy.toFixed(2)}R
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trade log */}
      {result.trades.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trade Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">#</th>
                    <th className="pb-2 pr-4 font-medium">Dir</th>
                    <th className="pb-2 pr-4 font-medium">Entry</th>
                    <th className="pb-2 pr-4 font-medium">Exit</th>
                    <th className="pb-2 pr-4 font-medium">Outcome</th>
                    <th className="pb-2 pr-4 font-medium">R</th>
                    <th className="pb-2 pr-4 font-medium">Bars</th>
                    <th className="pb-2 font-medium">Regime</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((t, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5 pr-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-1.5 pr-4 capitalize">{t.direction}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{t.entry_price.toFixed(2)}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{t.exit_price.toFixed(2)}</td>
                      <td className="py-1.5 pr-4">
                        <Badge
                          variant={
                            t.outcome === 'win'
                              ? 'default'
                              : t.outcome === 'loss'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="text-xs"
                        >
                          {t.outcome}
                        </Badge>
                      </td>
                      <td
                        className={`py-1.5 pr-4 tabular-nums ${t.r_multiple > 0 ? 'text-green-500' : t.r_multiple < 0 ? 'text-red-500' : ''}`}
                      >
                        {t.r_multiple > 0 ? '+' : ''}
                        {t.r_multiple.toFixed(2)}R
                      </td>
                      <td className="py-1.5 pr-4 tabular-nums text-muted-foreground">{t.bars_held}</td>
                      <td className="py-1.5 capitalize text-muted-foreground">{t.regime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* BULL-E analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" aria-hidden="true" />
            BULL-E Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isAnalyzing && !analysis && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          )}
          {analysis ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{analysis}</p>
          ) : !isAnalyzing ? (
            <p className="text-sm text-muted-foreground">
              Analysis unavailable — check that your ANTHROPIC_API_KEY is configured.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Save as Playbook modal ──────────────────────────── */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Playbook</DialogTitle>
          </DialogHeader>
          {saveSuccess ? (
            <p className="py-4 text-center text-sm text-green-500">
              Playbook saved successfully!
            </p>
          ) : (
            <>
              <div className="space-y-1.5 py-2">
                <Label htmlFor="playbook-name">Playbook Name</Label>
                <Input
                  id="playbook-name"
                  value={playbookName}
                  onChange={(e) => setPlaybookName(e.target.value)}
                  placeholder="e.g. RSI Oversold Bounce"
                  aria-label="Playbook name"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!playbookName.trim() || savePlaybook.isPending}
                  aria-label="Confirm save playbook"
                >
                  {savePlaybook.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    'Save'
                  )}
                </Button>
              </DialogFooter>
              {savePlaybook.error && (
                <p className="text-xs text-destructive" role="alert">
                  {(savePlaybook.error as Error).message}
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Run on More Tickers modal ───────────────────────── */}
      <Dialog open={multiOpen} onOpenChange={setMultiOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Run on More Tickers</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="multi-symbols">Symbols (comma or newline separated)</Label>
              <Textarea
                id="multi-symbols"
                value={multiSymbols}
                onChange={(e) => setMultiSymbols(e.target.value)}
                placeholder="AAPL, MSFT, GOOGL"
                className="min-h-[80px] font-mono text-sm"
                aria-label="Additional symbols to backtest"
              />
            </div>
            <Button
              onClick={handleMultiRun}
              disabled={isRunningMulti || !multiSymbols.trim()}
              className="w-full"
              aria-label="Run strategy on all symbols"
            >
              {isRunningMulti ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Running…
                </>
              ) : (
                'Run'
              )}
            </Button>

            {multiResults.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Symbol</th>
                      <th className="pb-2 pr-4 font-medium">Trades</th>
                      <th className="pb-2 pr-4 font-medium">Win Rate</th>
                      <th className="pb-2 font-medium">Expectancy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multiResults.map((mr) => (
                      <tr key={mr.symbol} className="border-b border-border/50 last:border-0">
                        <td className="py-1.5 pr-4 font-medium">{mr.symbol}</td>
                        {mr.error ? (
                          <td className="py-1.5 text-xs text-destructive" colSpan={3}>
                            {mr.error}
                          </td>
                        ) : mr.result ? (
                          <>
                            <td className="py-1.5 pr-4 tabular-nums">
                              {mr.result.total_trades}
                            </td>
                            <td className="py-1.5 pr-4 tabular-nums">
                              {(mr.result.win_rate * 100).toFixed(1)}%
                            </td>
                            <td
                              className={`py-1.5 tabular-nums ${mr.result.expectancy > 0 ? 'text-green-500' : 'text-red-500'}`}
                            >
                              {mr.result.expectancy.toFixed(2)}R
                            </td>
                          </>
                        ) : (
                          <td className="py-1.5" colSpan={3}>
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
