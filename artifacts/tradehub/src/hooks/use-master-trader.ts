import { useMemo } from "react";
import { useDerivTicks, type DerivTick, type DerivTickStatus } from "./use-deriv-ticks";

export const MASTER_SYMBOLS = [
  { id: "R_10", label: "Volatility 10" },
  { id: "R_25", label: "Volatility 25" },
  { id: "R_50", label: "Volatility 50" },
  { id: "R_75", label: "Volatility 75" },
  { id: "R_100", label: "Volatility 100" },
  { id: "1HZ10V", label: "Vol 10 (1s)" },
  { id: "1HZ100V", label: "Vol 100 (1s)" },
] as const;

export type SignalType = "OVER4" | "UNDER5" | "EVEN" | "ODD";
export type BiasType = "over" | "under" | "even" | "odd" | "none";

export type MarketSignal = {
  type: SignalType;
  label: string;
  confidence: number;
  epoch: number;
};

export type MarketAnalysis = {
  symbol: string;
  label: string;
  status: DerivTickStatus;
  tickCount: number;
  currentDigit: number | null;
  overPct: number;
  underPct: number;
  evenPct: number;
  oddPct: number;
  bias: BiasType;
  consecutiveBefore: number;
  signal: MarketSignal | null;
  recentDigits: number[];
};

export function getLastDigit(tick: DerivTick): number {
  const factor = Math.pow(10, tick.pip_size);
  return Math.floor(Math.round(tick.quote * factor)) % 10;
}

export function analyzeMarket(
  symbol: string,
  label: string,
  ticks: DerivTick[],
  status: DerivTickStatus,
): MarketAnalysis {
  const digits = ticks.map(getLastDigit);
  const n = digits.length;

  let overCount = 0; // digits >= 5
  let underCount = 0; // digits <= 4
  let evenCount = 0;
  let oddCount = 0;

  const window = digits.slice(-100);
  for (const d of window) {
    if (d >= 5) overCount++;
    else underCount++;
    if (d % 2 === 0) evenCount++;
    else oddCount++;
  }

  const total = window.length;
  const overPct = total ? (overCount / total) * 100 : 0;
  const underPct = total ? (underCount / total) * 100 : 0;
  const evenPct = total ? (evenCount / total) * 100 : 0;
  const oddPct = total ? (oddCount / total) * 100 : 0;

  const currentDigit = n > 0 ? digits[n - 1] : null;
  const prev = digits.slice(0, -1); // all before current

  // Count consecutive same-side run at the tail of prev
  function consecutiveTail(arr: number[], test: (d: number) => boolean): number {
    let count = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (test(arr[i])) count++;
      else break;
    }
    return count;
  }

  let bias: BiasType = "none";
  if (overPct >= 75) bias = "over";
  else if (underPct >= 75) bias = "under";
  else if (evenPct >= 75) bias = "even";
  else if (oddPct >= 75) bias = "odd";

  let signal: MarketSignal | null = null;
  let consecutiveBefore = 0;

  if (n >= 5 && currentDigit !== null) {
    // PRIMARY: Over/Under
    if (bias === "over") {
      // Market dominated by digits ≥5 → wait for reversal entry: 2+ digits ≤4 then current ≥5
      const consec = consecutiveTail(prev, (d) => d <= 4);
      consecutiveBefore = consec;
      if (consec >= 2 && currentDigit >= 5) {
        signal = {
          type: "OVER4",
          label: "Over 4",
          confidence: overPct,
          epoch: ticks[n - 1]!.epoch,
        };
      }
    } else if (bias === "under") {
      // Market dominated by digits ≤4 → wait for 2+ digits ≥5 then current ≤4
      const consec = consecutiveTail(prev, (d) => d >= 5);
      consecutiveBefore = consec;
      if (consec >= 2 && currentDigit <= 4) {
        signal = {
          type: "UNDER5",
          label: "Under 5",
          confidence: underPct,
          epoch: ticks[n - 1]!.epoch,
        };
      }
    }

    // SECONDARY: Even/Odd fallback
    if (!signal) {
      if (bias === "even") {
        // Market mostly even → wait for 3+ consecutive odd then trade EVEN
        const consec = consecutiveTail(prev, (d) => d % 2 === 1);
        consecutiveBefore = consec;
        if (consec >= 3 && currentDigit % 2 === 0) {
          signal = {
            type: "EVEN",
            label: "Digit Even",
            confidence: evenPct,
            epoch: ticks[n - 1]!.epoch,
          };
        }
      } else if (bias === "odd") {
        // Market mostly odd → wait for 3+ consecutive even then trade ODD
        const consec = consecutiveTail(prev, (d) => d % 2 === 0);
        consecutiveBefore = consec;
        if (consec >= 3 && currentDigit % 2 === 1) {
          signal = {
            type: "ODD",
            label: "Digit Odd",
            confidence: oddPct,
            epoch: ticks[n - 1]!.epoch,
          };
        }
      }
    }
  }

  return {
    symbol,
    label,
    status,
    tickCount: n,
    currentDigit,
    overPct,
    underPct,
    evenPct,
    oddPct,
    bias,
    consecutiveBefore,
    signal,
    recentDigits: digits.slice(-12),
  };
}

// Individual market hook
function useMarket(symbol: string, label: string): MarketAnalysis {
  const { ticks, status } = useDerivTicks(symbol, { bufferSize: 100 });
  return useMemo(
    () => analyzeMarket(symbol, label, ticks, status),
    [symbol, label, ticks, status],
  );
}

// Aggregate hook — fixed symbol count avoids conditional hook rules
export function useMasterTrader() {
  const r10 = useMarket("R_10", "Volatility 10");
  const r25 = useMarket("R_25", "Volatility 25");
  const r50 = useMarket("R_50", "Volatility 50");
  const r75 = useMarket("R_75", "Volatility 75");
  const r100 = useMarket("R_100", "Volatility 100");
  const hz10 = useMarket("1HZ10V", "Vol 10 (1s)");
  const hz100 = useMarket("1HZ100V", "Vol 100 (1s)");

  const markets: MarketAnalysis[] = [r10, r25, r50, r75, r100, hz10, hz100];

  const signals = markets.filter((m) => m.signal !== null);
  const bestSignal = signals.sort((a, b) => (b.signal?.confidence ?? 0) - (a.signal?.confidence ?? 0))[0] ?? null;

  const readyCount = markets.filter((m) => m.tickCount >= 20).length;
  const liveCount = markets.filter((m) => m.status === "open").length;

  return { markets, signals, bestSignal, readyCount, liveCount };
}
