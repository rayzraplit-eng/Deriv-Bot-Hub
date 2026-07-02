import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play, Square, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, Eye, RefreshCw,
} from "lucide-react";
import {
  useReverseOverUnder,
  type RouStatus,
  type RouMode,
  type RouPhase,
  type RouTradeType,
  type RouTrade,
} from "@/hooks/use-reverse-over-under";

const SYMBOLS = [
  { id: "R_10",    label: "Volatility 10"  },
  { id: "R_25",    label: "Volatility 25"  },
  { id: "R_50",    label: "Volatility 50"  },
  { id: "R_75",    label: "Volatility 75"  },
  { id: "R_100",   label: "Volatility 100" },
  { id: "1HZ10V",  label: "Vol 10 (1s)"   },
  { id: "1HZ100V", label: "Vol 100 (1s)"  },
] as const;

const TRADE_LABELS: Record<RouTradeType, { label: string; cls: string }> = {
  over2:  { label: "OVER 2",  cls: "border-primary/60 text-primary bg-primary/10"         },
  over4:  { label: "OVER 4",  cls: "border-chart-3/60 text-chart-3 bg-chart-3/10"        },
  under7: { label: "UNDER 7", cls: "border-purple-500/60 text-purple-400 bg-purple-500/10" },
  under5: { label: "UNDER 5", cls: "border-destructive/60 text-destructive bg-destructive/10" },
};

const STATUS_MAP: Record<RouStatus, { label: string; cls: string }> = {
  idle:     { label: "IDLE",     cls: "border-muted-foreground/40 text-muted-foreground bg-muted/20" },
  buffering:{ label: "LOADING…", cls: "border-chart-3/50 text-chart-3 bg-chart-3/10"               },
  watching: { label: "WATCHING", cls: "border-primary/50 text-primary bg-primary/10"               },
  trading:  { label: "TRADING",  cls: "border-primary/80 text-primary bg-primary/20"               },
};

function TypeBadge({ type }: { type: RouTradeType }) {
  const { label, cls } = TRADE_LABELS[type];
  return (
    <Badge variant="outline" className={`font-mono text-[10px] font-bold uppercase ${cls}`}>
      {label}
    </Badge>
  );
}

function TradeRow({ trade, fresh }: { trade: RouTrade; fresh: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all duration-500 ${
        fresh
          ? trade.result === "win"
            ? "border-primary/40 bg-primary/5"
            : "border-destructive/30 bg-destructive/5"
          : "border-border/40 bg-transparent"
      }`}
    >
      {trade.result === "win"
        ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
        : <XCircle      className="h-3.5 w-3.5 text-destructive shrink-0" />}
      <TypeBadge type={trade.type} />
      <span className="text-muted-foreground">Got</span>
      <span className={`font-bold ${trade.result === "win" ? "text-primary" : "text-destructive"}`}>
        {trade.actualDigit}
      </span>
      <span className="text-muted-foreground ml-auto">${trade.stake.toFixed(2)}</span>
    </div>
  );
}

function ModeIndicator({ mode, phase }: { mode: RouMode | null; phase: RouPhase }) {
  if (!mode) return null;
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
      mode === "over"
        ? "border-primary/30 bg-primary/5"
        : "border-purple-500/30 bg-purple-500/5"
    }`}>
      {mode === "over"
        ? <TrendingUp className="h-4 w-4 text-primary shrink-0" />
        : <TrendingDown className="h-4 w-4 text-purple-400 shrink-0" />}
      <div className="font-mono text-xs">
        <span className={`font-bold ${mode === "over" ? "text-primary" : "text-purple-400"}`}>
          {mode.toUpperCase()} MODE
        </span>
        <span className="text-muted-foreground ml-2">
          {phase === "entry" ? "Entry phase" : "Recovery phase (×1.8)"}
        </span>
      </div>
      <Badge variant="outline" className={`font-mono text-[9px] ml-auto shrink-0 uppercase ${
        phase === "entry"
          ? "border-primary/40 text-primary bg-primary/10"
          : "border-chart-3/40 text-chart-3 bg-chart-3/10"
      }`}>
        {phase}
      </Badge>
    </div>
  );
}

type Cfg = { symbol: string; stake: string };

function BotEngine({ cfg, onStop }: { cfg: Cfg; onStop: () => void }) {
  const base = parseFloat(cfg.stake) || 1;

  const {
    status, wsStatus, mode, phase, currentType,
    currentStake, consecutiveLosses, trades, recentDigits, tickCount,
  } = useReverseOverUnder(cfg.symbol, base, true);

  const freshIds = new Set(trades.slice(0, 1).map((t) => t.id));

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-center">
          <div className="font-mono text-[10px] text-muted-foreground uppercase mb-1">Mode</div>
          <div className={`font-mono text-base font-bold ${
            mode === "over" ? "text-primary" : mode === "under" ? "text-purple-400" : "text-muted-foreground"
          }`}>
            {mode ? mode.toUpperCase() : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-center">
          <div className="font-mono text-[10px] text-muted-foreground uppercase mb-1">Stake</div>
          <div className="font-mono text-base font-bold text-foreground">${currentStake.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-center">
          <div className="font-mono text-[10px] text-muted-foreground uppercase mb-1">Losses</div>
          <div className={`font-mono text-base font-bold ${consecutiveLosses > 0 ? "text-destructive" : "text-foreground"}`}>
            {consecutiveLosses}
          </div>
        </div>
      </div>

      {/* Mode indicator */}
      <ModeIndicator mode={mode} phase={phase} />

      {/* Current trade type */}
      {currentType && (
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground px-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Waiting {2} ticks for <TypeBadge type={currentType} /> result
        </div>
      )}

      {/* Recent digits strip */}
      {recentDigits.length > 0 && (
        <div className="flex items-center gap-1 px-1">
          <span className="font-mono text-[10px] text-muted-foreground mr-1">RECENT</span>
          {recentDigits.map((d, i) => (
            <span key={i} className={`font-mono text-xs w-5 h-5 rounded flex items-center justify-center font-bold ${
              i === recentDigits.length - 1
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}>{d}</span>
          ))}
        </div>
      )}

      {/* Status + stop */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`font-mono text-[10px] font-bold uppercase ${STATUS_MAP[status].cls}`}>
            {STATUS_MAP[status].label}
          </Badge>
          {wsStatus === "open" && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {tickCount} ticks
            </span>
          )}
        </div>
        <Button size="sm" variant="destructive" className="font-mono text-xs h-7" onClick={onStop}>
          <Square className="h-3 w-3 mr-1" /> Stop
        </Button>
      </div>

      {/* Trade log */}
      {trades.length > 0 ? (
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          <div className="font-mono text-[10px] text-muted-foreground uppercase mb-1">Trade Log</div>
          {trades.map((t) => (
            <TradeRow key={t.id} trade={t} fresh={freshIds.has(t.id)} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 p-4 text-center">
          <Eye className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" />
          <p className="font-mono text-xs text-muted-foreground">
            {status === "buffering" ? `Loading ticks… ${tickCount}/2` : "Watching for digit pattern…"}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
            Over: prev 8/9 → next 0/1/2 &nbsp;·&nbsp; Under: prev 0/1 → next 7/8/9
          </p>
        </div>
      )}
    </div>
  );
}

export function ReverseOverUnderInline() {
  const [cfg, setCfg]   = useState<Cfg | null>(null);
  const [form, setForm] = useState<Cfg>({ symbol: "R_100", stake: "1" });

  if (cfg) {
    return (
      <div className="space-y-4">
        <BotEngine cfg={cfg} onStop={() => setCfg(null)} />
      </div>
    );
  }

  const stakeVal = parseFloat(form.stake);
  const canStart = stakeVal > 0;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Watches digit transitions. Enters <span className="text-primary font-bold">Over 2</span> when prev digit is 8/9 and next is 0-2, or{" "}
        <span className="text-purple-400 font-bold">Under 7</span> when prev digit is 0/1 and next is 7-9.
        On loss, switches to <span className="text-chart-3 font-bold">Over 4 / Under 5</span> recovery every 2 ticks with{" "}
        <span className="text-foreground font-bold">×1.8 martingale</span>. Resets on win.
      </p>

      {/* Pattern reference */}
      <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-primary mb-1">
            <TrendingUp className="h-3 w-3" /> OVER SIDE
          </div>
          <div className="text-muted-foreground">Trigger: prev 8 or 9</div>
          <div className="text-muted-foreground">Next digit: 0, 1 or 2</div>
          <div className="text-foreground mt-1">Entry → <span className="text-primary">Over 2</span></div>
          <div className="text-foreground">Recovery → <span className="text-chart-3">Over 4</span> ×1.8</div>
        </div>
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-purple-400 mb-1">
            <TrendingDown className="h-3 w-3" /> UNDER SIDE
          </div>
          <div className="text-muted-foreground">Trigger: prev 0 or 1</div>
          <div className="text-muted-foreground">Next digit: 7, 8 or 9</div>
          <div className="text-foreground mt-1">Entry → <span className="text-purple-400">Under 7</span></div>
          <div className="text-foreground">Recovery → <span className="text-destructive">Under 5</span> ×1.8</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="font-mono text-xs text-muted-foreground uppercase">Market</Label>
          <Select value={form.symbol} onValueChange={(v) => setForm((f) => ({ ...f, symbol: v }))}>
            <SelectTrigger className="font-mono text-xs h-8 border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYMBOLS.map((s) => (
                <SelectItem key={s.id} value={s.id} className="font-mono text-xs">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="font-mono text-xs text-muted-foreground uppercase">Base Stake ($)</Label>
          <Input
            type="number"
            min="0.35"
            step="0.01"
            placeholder="e.g. 1.00"
            value={form.stake}
            onChange={(e) => setForm((f) => ({ ...f, stake: e.target.value }))}
            className="font-mono text-xs h-8 border-border/60"
          />
        </div>
      </div>

      <Button className="w-full font-mono text-xs h-9" onClick={() => setCfg({ ...form })} disabled={!canStart}>
        <Play className="h-3.5 w-3.5 mr-1.5" />
        Start Reverse Over/Under
      </Button>
    </div>
  );
}
