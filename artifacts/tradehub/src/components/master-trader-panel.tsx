import { useState, useEffect, useRef } from "react";
import { useMasterTrader, type MarketAnalysis, type SignalType } from "@/hooks/use-master-trader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Brain, Wifi, Play, Square, Zap, TrendingUp, TrendingDown,
  Minus, Clock, CheckCircle2, Loader2, DollarSign,
} from "lucide-react";

type SignalRecord = {
  id:                string;
  symbol:            string;
  label:             string;
  signalType:        SignalType;
  signalLabel:       string;
  bias:              string;
  confidence:        number;
  consecutiveBefore: number;
  currentDigit:      number | null;
  timestamp:         number;
  stake:             number;
};

function SignalBadge({ type }: { type: SignalType }) {
  const styles: Record<SignalType, string> = {
    OVER4:  "border-primary/60 text-primary bg-primary/15",
    UNDER5: "border-destructive/60 text-destructive bg-destructive/15",
    EVEN:   "border-chart-3/60 text-chart-3 bg-chart-3/15",
    ODD:    "border-purple-500/60 text-purple-400 bg-purple-500/15",
  };
  const labels: Record<SignalType, string> = {
    OVER4:  "↑ OVER 4",
    UNDER5: "↓ UNDER 5",
    EVEN:   "~ EVEN",
    ODD:    "~ ODD",
  };
  return (
    <Badge variant="outline" className={`font-mono text-[10px] font-bold shrink-0 ${styles[type]}`}>
      {labels[type]}
    </Badge>
  );
}

function SignalIcon({ type }: { type: SignalType }) {
  if (type === "OVER4")  return <TrendingUp  className="h-4 w-4 text-primary"     />;
  if (type === "UNDER5") return <TrendingDown className="h-4 w-4 text-destructive" />;
  return                        <Minus        className="h-4 w-4 text-chart-3"     />;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function LiveSignalCard({ m, stake }: { m: MarketAnalysis; stake: number }) {
  return (
    <Card className="border-primary/50 bg-primary/5 shadow-lg shadow-primary/10 animate-in fade-in slide-in-from-top-2 duration-400">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Zap className="h-5 w-5 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-ping" />
            </div>
            <div>
              <div className="font-mono text-sm font-bold text-foreground">
                {m.symbol}
                <span className="text-muted-foreground font-normal"> · {m.label}</span>
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {m.bias.toUpperCase()} BIAS {m.signal!.confidence.toFixed(0)}% ·{" "}
                {m.consecutiveBefore} reversal streak · digit {m.currentDigit}
                {stake > 0 && (
                  <span className="text-primary ml-2 font-bold">${stake.toFixed(2)}</span>
                )}
              </div>
            </div>
          </div>
          <SignalBadge type={m.signal!.type} />
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryRow({ rec, fresh }: { rec: SignalRecord; fresh: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-500 ${
        fresh ? "border-primary/30 bg-primary/5" : "border-border/40 bg-transparent"
      }`}
    >
      <SignalIcon type={rec.signalType} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-bold text-foreground">{rec.symbol}</span>
          <SignalBadge type={rec.signalType} />
          {rec.stake > 0 && (
            <span className="font-mono text-[10px] text-primary font-bold">${rec.stake.toFixed(2)}</span>
          )}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
          {rec.bias.toUpperCase()} BIAS {rec.confidence.toFixed(0)}% · {rec.consecutiveBefore}-streak · digit {rec.currentDigit ?? "—"}
        </div>
      </div>
      <div className="font-mono text-[10px] text-muted-foreground/60 shrink-0 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {timeAgo(rec.timestamp)}
      </div>
    </div>
  );
}

export function MasterTraderPanel() {
  const { markets, signals, readyCount, liveCount } = useMasterTrader();
  const total = markets.length;

  const [running,   setRunning]   = useState(false);
  const [stakeStr,  setStakeStr]  = useState("1.00");
  const [history,   setHistory]   = useState<SignalRecord[]>([]);
  const [freshIds,  setFreshIds]  = useState<Set<string>>(new Set());
  const seenKeys                  = useRef<Set<string>>(new Set());
  const bufferingCount            = markets.filter((m) => m.tickCount < 100 && m.status === "open").length;
  const isBuffering               = running && readyCount < total;

  const stake = parseFloat(stakeStr) || 0;

  useEffect(() => {
    if (!running) return;
    for (const m of signals) {
      if (!m.signal) continue;
      const key = `${m.symbol}-${m.signal.epoch}`;
      if (seenKeys.current.has(key)) continue;
      seenKeys.current.add(key);

      const rec: SignalRecord = {
        id:                key,
        symbol:            m.symbol,
        label:             m.label,
        signalType:        m.signal.type,
        signalLabel:       m.signal.label,
        bias:              m.bias,
        confidence:        m.signal.confidence,
        consecutiveBefore: m.consecutiveBefore,
        currentDigit:      m.currentDigit,
        timestamp:         Date.now(),
        stake,
      };

      setHistory((prev) => [rec, ...prev].slice(0, 30));
      setFreshIds((prev) => new Set(prev).add(key));

      setTimeout(() => {
        setFreshIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 8000);
    }
  }, [signals, running, stake]);

  // ── IDLE SCREEN ─────────────────────────────────────────────────────────────
  if (!running) {
    return (
      <section className="flex flex-col items-center justify-center min-h-[55vh] gap-5 px-4 animate-in fade-in duration-500">
        <div className="relative">
          <div className="h-20 w-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Brain className="h-10 w-10 text-primary" />
          </div>
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-muted border border-border flex items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          </span>
        </div>

        <div className="text-center space-y-2">
          <h2 className="font-mono text-2xl font-bold tracking-tight text-foreground">MASTER TRADER</h2>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Silently monitors <span className="text-foreground font-medium">all 10 volatility markets</span> using a 100-tick bias window.
          </p>
        </div>

        <div className="w-full max-w-xs space-y-1.5 font-mono text-[11px]">
          <div className="flex gap-2 items-start">
            <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0 mt-px" />
            <span className="text-muted-foreground"><span className="text-primary font-bold">OVER 4</span> — ≥75% over bias · 2+ under streak · current ≥5</span>
          </div>
          <div className="flex gap-2 items-start">
            <TrendingDown className="h-3.5 w-3.5 text-destructive shrink-0 mt-px" />
            <span className="text-muted-foreground"><span className="text-destructive font-bold">UNDER 5</span> — ≥75% under bias · 2+ over streak · current ≤4</span>
          </div>
          <div className="flex gap-2 items-start">
            <Minus className="h-3.5 w-3.5 text-chart-3 shrink-0 mt-px" />
            <span className="text-muted-foreground"><span className="text-chart-3 font-bold">EVEN</span> — ≥75% even bias · 3+ odd streak · current even</span>
          </div>
          <div className="flex gap-2 items-start">
            <Minus className="h-3.5 w-3.5 text-purple-400 shrink-0 mt-px" />
            <span className="text-muted-foreground"><span className="text-purple-400 font-bold">ODD</span> — ≥75% odd bias · 3+ even streak · current odd</span>
          </div>
        </div>

        {/* ── Stake input ── */}
        <div className="w-full max-w-xs space-y-1.5">
          <Label className="font-mono text-xs text-muted-foreground uppercase flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Stake per Signal ($)
          </Label>
          <Input
            type="number"
            min="0.35"
            step="0.01"
            placeholder="e.g. 1.00"
            value={stakeStr}
            onChange={(e) => setStakeStr(e.target.value)}
            className="font-mono text-xs h-8 border-border/60 max-w-xs"
          />
          <p className="font-mono text-[10px] text-muted-foreground">
            Shown on each signal as a trade suggestion.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <Wifi className="h-3.5 w-3.5 text-primary" />
          <span>{liveCount}/{total} markets connected</span>
        </div>

        <Button
          size="lg"
          className="gap-2 font-mono font-bold tracking-wider px-10 h-12 text-base"
          onClick={() => setRunning(true)}
        >
          <Play className="h-5 w-5" />
          RUN BOT
        </Button>

        {history.length > 0 && (
          <p className="text-[11px] font-mono text-muted-foreground/50">
            {history.length} signal{history.length !== 1 ? "s" : ""} logged in previous session
          </p>
        )}
      </section>
    );
  }

  // ── RUNNING SCREEN ──────────────────────────────────────────────────────────
  const activeSignals = signals.filter((m) => m.signal !== null);

  return (
    <section className="space-y-4 animate-in fade-in duration-400">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Brain className="h-5 w-5 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-ping" />
          </div>
          <div>
            <h2 className="font-mono text-base font-bold tracking-tight text-foreground leading-none">MASTER TRADER</h2>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
              {isBuffering
                ? `Buffering ticks… ${readyCount}/${total} markets ready`
                : `${readyCount}/${total} markets ready · scanning`}
              {stake > 0 && <span className="text-primary ml-2 font-bold">· ${stake.toFixed(2)}/signal</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] border-primary/40 text-primary bg-primary/10 gap-1">
            <Wifi className="h-3 w-3" /> {liveCount}/{total}
          </Badge>
          {activeSignals.length > 0 && (
            <Badge variant="outline" className="font-mono text-[10px] border-chart-3/60 text-chart-3 bg-chart-3/10 gap-1 animate-pulse">
              <Zap className="h-3 w-3" /> {activeSignals.length} signal{activeSignals.length > 1 ? "s" : ""}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 font-mono text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setRunning(false)}
          >
            <Square className="h-3.5 w-3.5" /> Stop
          </Button>
        </div>
      </div>

      {/* Buffering progress */}
      {isBuffering && (
        <Card className="border-border/40 bg-muted/10">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>Collecting 100-tick windows</span>
                  <span>{readyCount}/{total} ready</span>
                </div>
                <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all duration-500"
                    style={{ width: `${(readyCount / total) * 100}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {markets.map((m) => (
                    <span
                      key={m.symbol}
                      className={`font-mono text-[9px] px-1.5 py-0.5 rounded border ${
                        m.tickCount >= 100
                          ? "border-primary/40 text-primary bg-primary/10"
                          : m.status === "open"
                          ? "border-chart-3/40 text-chart-3 bg-chart-3/5"
                          : "border-border/40 text-muted-foreground/40"
                      }`}
                    >
                      {m.symbol} {m.tickCount >= 100 ? "✓" : m.tickCount}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeSignals.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider px-0.5">⚡ Live Signals</p>
          {activeSignals.map((m) => (
            <LiveSignalCard key={m.symbol} m={m} stake={stake} />
          ))}
        </div>
      )}

      {activeSignals.length === 0 && readyCount === total && (
        <Card className="border-border/30 bg-muted/5">
          <CardContent className="py-8 px-4 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-8 w-8 text-primary/50" />
            <div>
              <p className="font-mono text-sm font-medium text-foreground">Scanning markets…</p>
              <p className="font-mono text-[11px] text-muted-foreground mt-1">
                All {total} markets ready · waiting for reversal entry conditions
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Signal History</p>
            <span className="font-mono text-[10px] text-muted-foreground/50">{history.length} total</span>
          </div>
          <div className="space-y-1.5">
            {history.map((rec) => (
              <HistoryRow key={rec.id} rec={rec} fresh={freshIds.has(rec.id)} />
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && readyCount === total && activeSignals.length === 0 && (
        <div className="text-center font-mono text-[11px] text-muted-foreground/40 py-4">
          No signals yet · history will appear here
        </div>
      )}
    </section>
  );
}
