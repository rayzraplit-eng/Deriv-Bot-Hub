import { useMasterTrader, type MarketAnalysis, type BiasType, type SignalType } from "@/hooks/use-master-trader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Wifi, WifiOff, Loader2, Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { DerivTickStatus } from "@/hooks/use-deriv-ticks";

function StatusDot({ status }: { status: DerivTickStatus }) {
  if (status === "open") return <span className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />;
  if (status === "connecting") return <Loader2 className="h-2.5 w-2.5 text-chart-3 animate-spin shrink-0" />;
  return <span className="h-2 w-2 rounded-full bg-destructive/60 shrink-0" />;
}

function SignalBadge({ type }: { type: SignalType }) {
  const styles: Record<SignalType, string> = {
    OVER4: "border-primary/60 text-primary bg-primary/15",
    UNDER5: "border-destructive/60 text-destructive bg-destructive/15",
    EVEN: "border-chart-3/60 text-chart-3 bg-chart-3/15",
    ODD: "border-purple-500/60 text-purple-400 bg-purple-500/15",
  };
  const labels: Record<SignalType, string> = {
    OVER4: "↑ OVER 4",
    UNDER5: "↓ UNDER 5",
    EVEN: "~ EVEN",
    ODD: "~ ODD",
  };
  return (
    <Badge variant="outline" className={`font-mono text-[10px] font-bold ${styles[type]}`}>
      {labels[type]}
    </Badge>
  );
}

function BiasBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
        <span>{label}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function DigitPills({ digits }: { digits: number[] }) {
  return (
    <div className="flex gap-0.5 flex-wrap">
      {digits.map((d, i) => {
        const isLast = i === digits.length - 1;
        const isOver = d >= 5;
        const isEven = d % 2 === 0;
        return (
          <span
            key={i}
            className={`font-mono text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded ${
              isLast
                ? "ring-1 ring-foreground/50 bg-foreground/10 text-foreground"
                : isOver
                ? "text-primary/70"
                : "text-destructive/70"
            } ${isEven ? "opacity-90" : "opacity-60"}`}
          >
            {d}
          </span>
        );
      })}
    </div>
  );
}

function MarketCard({ m }: { m: MarketAnalysis }) {
  const hasSignal = m.signal !== null;
  const biasIcon: Record<BiasType, React.ReactNode> = {
    over: <TrendingUp className="h-3 w-3 text-primary" />,
    under: <TrendingDown className="h-3 w-3 text-destructive" />,
    even: <Minus className="h-3 w-3 text-chart-3" />,
    odd: <Minus className="h-3 w-3 text-purple-400" />,
    none: <Minus className="h-3 w-3 text-muted-foreground/40" />,
  };
  const biasLabel: Record<BiasType, string> = {
    over: "OVER BIAS",
    under: "UNDER BIAS",
    even: "EVEN BIAS",
    odd: "ODD BIAS",
    none: "NO BIAS",
  };

  return (
    <Card
      className={`border shadow-md bg-card/50 backdrop-blur-sm transition-all duration-300 ${
        hasSignal
          ? "border-primary/60 shadow-primary/10 shadow-lg ring-1 ring-primary/20"
          : "border-border/60"
      }`}
    >
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <StatusDot status={m.status} />
            <span className="font-mono text-xs font-bold truncate">{m.symbol}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {biasIcon[m.bias]}
            <span className="font-mono text-[9px] text-muted-foreground">{biasLabel[m.bias]}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2.5">
        {m.tickCount < 10 ? (
          <div className="text-[10px] font-mono text-muted-foreground/50 text-center py-2">
            Buffering… {m.tickCount}/10
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <BiasBar label="Over (≥5)" pct={m.overPct} color="bg-primary/70" />
              <BiasBar label="Under (≤4)" pct={m.underPct} color="bg-destructive/70" />
              <BiasBar label="Even" pct={m.evenPct} color="bg-chart-3/70" />
              <BiasBar label="Odd" pct={m.oddPct} color="bg-purple-500/70" />
            </div>

            <DigitPills digits={m.recentDigits} />

            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] text-muted-foreground">
                {m.tickCount} ticks · digit {m.currentDigit ?? "—"}
                {m.consecutiveBefore > 0 && (
                  <span className="text-chart-3"> · {m.consecutiveBefore} streak</span>
                )}
              </span>
              {hasSignal && <SignalBadge type={m.signal!.type} />}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function MasterTraderPanel() {
  const { markets, signals, bestSignal, readyCount, liveCount } = useMasterTrader();

  return (
    <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-mono font-bold tracking-tight text-foreground flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            MASTER TRADER
          </h2>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Scanning all volatility markets · 100-tick bias analysis · auto reversal signals
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="font-mono text-[10px] border-primary/40 text-primary bg-primary/10 flex items-center gap-1">
            <Wifi className="h-3 w-3" />
            {liveCount}/{markets.length} live
          </Badge>
          <Badge variant="outline" className="font-mono text-[10px] border-muted-foreground/40 text-muted-foreground">
            {readyCount}/{markets.length} ready
          </Badge>
          {signals.length > 0 && (
            <Badge variant="outline" className="font-mono text-[10px] border-chart-3/60 text-chart-3 bg-chart-3/10 flex items-center gap-1 animate-pulse">
              <Zap className="h-3 w-3" />
              {signals.length} signal{signals.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Best signal callout */}
      {bestSignal?.signal && (
        <Card className="border-primary/50 bg-primary/5 shadow-lg shadow-primary/10">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary animate-pulse" />
                <div>
                  <div className="font-mono text-sm font-bold text-primary">
                    ENTRY SIGNAL · {bestSignal.symbol}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {bestSignal.label} · {bestSignal.bias.toUpperCase()} BIAS ({bestSignal.signal.confidence.toFixed(0)}%)
                    · {bestSignal.consecutiveBefore} consecutive streak reversed
                  </div>
                </div>
              </div>
              <SignalBadge type={bestSignal.signal.type} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategy legend */}
      <Card className="border-border/40 bg-muted/10">
        <CardContent className="py-2.5 px-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[10px] text-muted-foreground">
            <span><span className="text-primary font-bold">OVER4</span> — ≥75% over bias + 2+ streak ≤4 → current ≥5</span>
            <span><span className="text-destructive font-bold">UNDER5</span> — ≥75% under bias + 2+ streak ≥5 → current ≤4</span>
            <span><span className="text-chart-3 font-bold">EVEN</span> — ≥75% even bias + 3+ odd streak → current even</span>
            <span><span className="text-purple-400 font-bold">ODD</span> — ≥75% odd bias + 3+ even streak → current odd</span>
          </div>
        </CardContent>
      </Card>

      {/* Market grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {markets.map((m) => (
          <MarketCard key={m.symbol} m={m} />
        ))}
      </div>

      {/* All active signals list */}
      {signals.length > 0 && (
        <Card className="border-border shadow-md bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
              <Zap className="h-4 w-4 text-chart-3" />
              Active Signals ({signals.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {signals.map((m) => (
              <div
                key={m.symbol}
                className="flex items-center justify-between p-2.5 rounded-lg border border-primary/20 bg-primary/5"
              >
                <div className="flex items-center gap-3">
                  <StatusDot status={m.status} />
                  <div>
                    <div className="font-mono text-sm font-bold">{m.symbol}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {m.label} · {m.bias.toUpperCase()} BIAS {m.signal!.confidence.toFixed(0)}%
                      · {m.consecutiveBefore}-streak reversed · digit {m.currentDigit}
                    </div>
                  </div>
                </div>
                <SignalBadge type={m.signal!.type} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
