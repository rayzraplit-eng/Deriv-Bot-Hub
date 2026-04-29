import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart2, Activity, Pause, Play, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const SYMBOLS = [
  { id: "R_10", label: "Volatility 10" },
  { id: "R_25", label: "Volatility 25" },
  { id: "R_50", label: "Volatility 50" },
  { id: "R_75", label: "Volatility 75" },
  { id: "R_100", label: "Volatility 100" },
  { id: "BOOM1000", label: "Boom 1000" },
  { id: "CRASH500", label: "Crash 500" },
];

const SAMPLE_SIZES = [120, 240, 500, 1000];

type Tick = { value: number; ts: number };

function generateTickStream(symbol: string, count: number, seed: number): Tick[] {
  let x = seed * 9301 + symbol.length * 49297;
  const rand = () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
  let price = 100 + rand() * 50;
  const ticks: Tick[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    price += (rand() - 0.5) * 0.3;
    ticks.push({ value: Math.round(price * 100), ts: now - (count - i) * 1000 });
  }
  return ticks;
}

export function AnalisisToolSection() {
  const [symbol, setSymbol] = useState<string>("R_75");
  const [sample, setSample] = useState<number>(500);
  const [running, setRunning] = useState<boolean>(true);
  const [seed, setSeed] = useState<number>(1);
  const [ticks, setTicks] = useState<Tick[]>(() => generateTickStream("R_75", 500, 1));
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    setTicks(generateTickStream(symbol, sample, seed));
  }, [symbol, sample, seed]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setTicks((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1].value;
        const drift = (Math.random() - 0.5) * 30;
        const next: Tick = { value: Math.max(1, Math.round(last + drift)), ts: Date.now() };
        return [...prev.slice(1), next];
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running]);

  const lastDigits = ticks.map((t) => t.value % 10);
  const digitCounts = Array.from({ length: 10 }, (_, d) => ({
    digit: d,
    count: lastDigits.filter((x) => x === d).length,
  }));
  const total = lastDigits.length || 1;
  const digitData = digitCounts.map((d) => ({
    digit: String(d.digit),
    pct: +((d.count / total) * 100).toFixed(2),
    count: d.count,
  }));
  const maxPct = Math.max(...digitData.map((d) => d.pct));
  const minPct = Math.min(...digitData.map((d) => d.pct));

  const evenCount = lastDigits.filter((d) => d % 2 === 0).length;
  const oddCount = total - evenCount;
  const overCount = lastDigits.filter((d) => d > 4).length;
  const underCount = total - overCount;
  const matchesCount = lastDigits.length > 1 ? lastDigits.slice(1).filter((d, i) => d === lastDigits[i]).length : 0;

  const lastTick = ticks[ticks.length - 1]?.value ?? 0;
  const prevTick = ticks[ticks.length - 2]?.value ?? lastTick;
  const direction = lastTick - prevTick;

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-2xl font-mono font-bold tracking-tight text-foreground flex items-center gap-2">
          <BarChart2 className="h-7 w-7 text-primary" />
          ANALISIS TOOL
        </h2>
        <div className="flex items-center gap-2">
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="w-[180px] h-9 font-mono text-xs" data-testid="select-analisis-symbol">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYMBOLS.map((s) => (
                <SelectItem key={s.id} value={s.id} className="font-mono text-xs">
                  {s.id} — {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(sample)} onValueChange={(v) => setSample(Number(v))}>
            <SelectTrigger className="w-[110px] h-9 font-mono text-xs" data-testid="select-analisis-sample">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SAMPLE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)} className="font-mono text-xs">
                  {n} ticks
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-9 font-mono text-xs"
            onClick={() => setRunning((r) => !r)}
            data-testid="button-analisis-toggle"
          >
            {running ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            {running ? "Pause" : "Resume"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 font-mono text-xs"
            onClick={() => setSeed((s) => s + 1)}
            data-testid="button-analisis-refresh"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground font-mono mb-4">
        Last-digit distribution and even/odd, over/under, matches statistics across the latest tick window.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Last Digit Distribution
              </CardTitle>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-muted-foreground">LAST</span>
                <span className={`font-bold ${direction > 0 ? "text-primary" : direction < 0 ? "text-destructive" : "text-foreground"}`}>
                  {(lastTick / 100).toFixed(2)}
                </span>
                <Badge variant="outline" className="font-mono text-[10px] border-border/60">
                  {symbol}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={digitData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="digit" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontFamily: "monospace" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                    formatter={(value: number, _name, item: any) => [`${value}% (${item?.payload?.count ?? 0} ticks)`, `Digit ${item?.payload?.digit}`]}
                  />
                  <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                    {digitData.map((d) => (
                      <Cell key={d.digit} fill={d.pct === maxPct ? "hsl(var(--primary))" : d.pct === minPct ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-10 gap-1 mt-3">
              {digitData.map((d) => (
                <div
                  key={d.digit}
                  className={`text-center py-1 rounded font-mono text-xs border ${
                    d.pct === maxPct
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : d.pct === minPct
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-border/40 bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <div className="font-bold">{d.digit}</div>
                  <div className="text-[10px] opacity-80">{d.pct}%</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase">Bias Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <BiasRow label="Even" valueA={evenCount} valueB={oddCount} labelA="EVEN" labelB="ODD" total={total} />
            <BiasRow label="Over/Under" valueA={overCount} valueB={underCount} labelA="OVER 4" labelB="UNDER 5" total={total} />
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
              <div>
                <div className="font-mono font-bold text-sm">Matches</div>
                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">consecutive same-digit</div>
              </div>
              <div className="text-right font-mono">
                <div className="text-lg font-bold text-foreground">{matchesCount}</div>
                <div className="text-[11px] text-muted-foreground">{((matchesCount / Math.max(total - 1, 1)) * 100).toFixed(1)}%</div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono pt-2 border-t border-border/40">
              Sample of {total.toLocaleString()} ticks · {running ? "live updating" : "paused"}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function BiasRow({
  label,
  valueA,
  valueB,
  labelA,
  labelB,
  total,
}: {
  label: string;
  valueA: number;
  valueB: number;
  labelA: string;
  labelB: string;
  total: number;
}) {
  const pctA = total > 0 ? (valueA / total) * 100 : 0;
  const pctB = 100 - pctA;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground uppercase">
        <span>{label}</span>
        <span>
          <span className="text-primary font-bold">{pctA.toFixed(1)}%</span>
          <span className="mx-1 text-muted-foreground/60">/</span>
          <span className="text-chart-3 font-bold">{pctB.toFixed(1)}%</span>
        </span>
      </div>
      <div className="flex h-6 w-full overflow-hidden rounded border border-border/50 bg-muted/30 font-mono text-[10px]">
        <div
          className="bg-primary/30 text-primary flex items-center justify-center transition-all"
          style={{ width: `${pctA}%` }}
        >
          {pctA > 18 ? labelA : ""}
        </div>
        <div
          className="bg-chart-3/30 text-chart-3 flex items-center justify-center transition-all"
          style={{ width: `${pctB}%` }}
        >
          {pctB > 18 ? labelB : ""}
        </div>
      </div>
    </div>
  );
}

