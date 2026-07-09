import { useEffect, useRef, useState } from "react";
import { useDerivTicks } from "./use-deriv-ticks";
import { getLastDigit } from "./use-master-trader";

export const DIFFERS_MARTINGALE = 2;
export const DIFFER_WINDOW = 75;

export type DifferStatus =
  | "idle"
  | "buffering"
  | "watching"
  | "recovering"
  | "max-losses";

export type DifferSide = "differ" | "over3" | "under6";

export type DifferTrade = {
  id: string;
  symbol: string;
  side: DifferSide;
  contract: string;
  barrier: number;
  digit: number;
  stake: number;
  result: "win" | "loss";
  recovery: boolean;
  epoch: number;
};

type SymbolState = {
  status: DifferStatus;
  leastDigit: number | null;
  currentStake: number;
  consecutiveLosses: number;
  inRecovery: boolean;
  recoverySide: "over3" | "under6" | null;
  lastEpoch: number;
};

function freshState(baseStake: number): SymbolState {
  return {
    status: "buffering",
    leastDigit: null,
    currentStake: baseStake,
    consecutiveLosses: 0,
    inRecovery: false,
    recoverySide: null,
    lastEpoch: 0,
  };
}

function leastAppearingDigit(digits: number[]): number {
  const counts = new Array(10).fill(0) as number[];
  for (const d of digits) counts[d]++;
  let best = Infinity;
  let least = 0;
  for (let i = 0; i < 10; i++) {
    if (counts[i]! < best) {
      best = counts[i]!;
      least = i;
    }
  }
  return least;
}

function consecutiveTail(arr: number[], test: (d: number) => boolean): number {
  let count = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (test(arr[i]!)) count++;
    else break;
  }
  return count;
}

/**
 * Differs Pro — single-symbol engine (one instance per volatility index).
 *
 * PRIMARY (DIFFER): tracks the least-appearing digit over the last
 * `DIFFER_WINDOW` (75) ticks. The instant that digit shifts to a new one,
 * it fires a DIGITDIFF trade against the new least-appearing digit — no
 * extra confirmation tick, so all symbols that shift on the same tick fire
 * simultaneously (up to one trade per symbol, 10 symbols total).
 *
 * RECOVERY (only after a DIFFER loss on this same symbol): reads which side
 * of the market is leading over the most recent 20 digits —
 *   - digits >3 leading  -> watch for 2+ consecutive digits <=3 then a
 *     trigger digit >=4 -> buy DIGITOVER barrier 3
 *   - digits <6 leading (majority <=5) -> watch for 2+ consecutive digits
 *     >=6 then a trigger digit <=5 -> buy DIGITUNDER barrier 6
 * Recovery stays on that one side, doubling the stake (×2 martingale) on
 * every loss, until it wins or hits maxLosses. A win resets the symbol back
 * to watching for the next DIFFER shift at the base stake.
 */
function useDifferSymbol(
  symbol: string,
  label: string,
  baseStake: number,
  maxLosses: number,
  enabled: boolean,
) {
  const { ticks, status: wsStatus } = useDerivTicks(symbol, {
    bufferSize: 300,
    enabled,
  });

  const [status, setStatus] = useState<DifferStatus>("idle");
  const [leastDigit, setLeastDigit] = useState<number | null>(null);
  const [currentStake, setCurrentStake] = useState(baseStake);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [trades, setTrades] = useState<DifferTrade[]>([]);

  const ref = useRef<SymbolState>(freshState(baseStake));

  // Reset when disabled, or when stake/symbol changes
  useEffect(() => {
    ref.current = freshState(baseStake);
    setStatus(enabled ? "buffering" : "idle");
    setLeastDigit(null);
    setCurrentStake(baseStake);
    setConsecutiveLosses(0);
    setTrades([]);
  }, [enabled, baseStake, symbol]);

  useEffect(() => {
    if (!enabled) return;
    if (ticks.length < DIFFER_WINDOW) return;

    const r = ref.current;
    if (r.status === "max-losses") return;

    const lastTick = ticks[ticks.length - 1]!;
    if (lastTick.epoch === r.lastEpoch) return;
    r.lastEpoch = lastTick.epoch;

    const digits = ticks.map(getLastDigit);
    const window75 = digits.slice(-DIFFER_WINDOW);
    const currentDigit = digits[digits.length - 1]!;
    const prev = digits.slice(0, -1);
    const least = leastAppearingDigit(window75);
    setLeastDigit(least);

    if (r.inRecovery && r.recoverySide) {
      let fired = false;
      let contract = "";
      let barrier = 0;
      const side: DifferSide = r.recoverySide;

      if (r.recoverySide === "over3") {
        const streak = consecutiveTail(prev, (d) => d <= 3);
        if (streak >= 2 && currentDigit >= 4) {
          contract = "DIGITOVER";
          barrier = 3;
          fired = true;
        }
      } else {
        const streak = consecutiveTail(prev, (d) => d >= 6);
        if (streak >= 2 && currentDigit <= 5) {
          contract = "DIGITUNDER";
          barrier = 6;
          fired = true;
        }
      }

      if (fired) {
        const isWin = side === "over3" ? currentDigit > barrier : currentDigit < barrier;
        const trade: DifferTrade = {
          id: `${symbol}-rec-${lastTick.epoch}-${Math.random().toString(36).slice(2)}`,
          symbol,
          side,
          contract,
          barrier,
          digit: currentDigit,
          stake: r.currentStake,
          result: isWin ? "win" : "loss",
          recovery: true,
          epoch: lastTick.epoch,
        };
        setTrades((p) => [trade, ...p].slice(0, 60));

        if (isWin) {
          r.inRecovery = false;
          r.recoverySide = null;
          r.currentStake = baseStake;
          r.consecutiveLosses = 0;
          r.status = "watching";
          setCurrentStake(baseStake);
          setConsecutiveLosses(0);
          setStatus("watching");
        } else {
          r.consecutiveLosses++;
          setConsecutiveLosses(r.consecutiveLosses);
          if (r.consecutiveLosses >= maxLosses) {
            r.status = "max-losses";
            setStatus("max-losses");
          } else {
            r.currentStake = parseFloat((r.currentStake * DIFFERS_MARTINGALE).toFixed(2));
            setCurrentStake(r.currentStake);
            // stay in recovery on the same side, wait for the entry condition again
          }
        }
      }
      return;
    }

    // Not recovering: watch the least-appearing digit for a shift.
    r.status = "watching";
    setStatus((s) => (s === "recovering" ? s : "watching"));

    const shifted = r.leastDigit !== null && least !== r.leastDigit;
    r.leastDigit = least;

    if (!shifted) return;

    // Shift detected — fire DIGITDIFF immediately against the new least-appearing digit.
    const isWin = currentDigit !== least;
    const trade: DifferTrade = {
      id: `${symbol}-diff-${lastTick.epoch}-${Math.random().toString(36).slice(2)}`,
      symbol,
      side: "differ",
      contract: "DIGITDIFF",
      barrier: least,
      digit: currentDigit,
      stake: r.currentStake,
      result: isWin ? "win" : "loss",
      recovery: false,
      epoch: lastTick.epoch,
    };
    setTrades((p) => [trade, ...p].slice(0, 60));

    if (isWin) {
      r.currentStake = baseStake;
      setCurrentStake(baseStake);
      setStatus("watching");
    } else {
      // Loss — pick the leading side of the market over the recent window to recover.
      // The first recovery attempt uses the base stake; ×2 martingale only kicks in
      // after a recovery attempt itself loses (see the fired-recovery-loss branch above).
      const recentWindow = digits.slice(-20);
      const aboveCount = recentWindow.filter((d) => d > 3).length;
      const belowCount = recentWindow.filter((d) => d < 6).length;
      const side: "over3" | "under6" = aboveCount >= belowCount ? "over3" : "under6";

      r.inRecovery = true;
      r.recoverySide = side;
      r.consecutiveLosses = 0;
      r.currentStake = baseStake;
      setConsecutiveLosses(0);
      setCurrentStake(r.currentStake);
      r.status = "recovering";
      setStatus("recovering");
    }
  }, [ticks, enabled, maxLosses, baseStake, symbol]);

  const recentDigits = ticks.slice(-20).map(getLastDigit);

  return {
    symbol,
    label,
    wsStatus,
    tickCount: ticks.length,
    status,
    leastDigit,
    currentStake,
    consecutiveLosses,
    recoverySide: ref.current.recoverySide,
    trades,
    recentDigits,
  };
}

export type DifferMarket = ReturnType<typeof useDifferSymbol>;

/**
 * Differs Pro bot — runs the single-symbol engine across all 10 fixed
 * volatility indices at once (hook rules forbid calling hooks in a loop, so
 * each symbol gets its own explicit call, mirroring useMasterTrader).
 */
export function useDiffersPro(baseStake: number, maxLosses: number, enabled: boolean) {
  const r10 = useDifferSymbol("R_10", "Volatility 10", baseStake, maxLosses, enabled);
  const r25 = useDifferSymbol("R_25", "Volatility 25", baseStake, maxLosses, enabled);
  const r50 = useDifferSymbol("R_50", "Volatility 50", baseStake, maxLosses, enabled);
  const r75 = useDifferSymbol("R_75", "Volatility 75", baseStake, maxLosses, enabled);
  const r100 = useDifferSymbol("R_100", "Volatility 100", baseStake, maxLosses, enabled);
  const hz10 = useDifferSymbol("1HZ10V", "Vol 10 (1s)", baseStake, maxLosses, enabled);
  const hz25 = useDifferSymbol("1HZ25V", "Vol 25 (1s)", baseStake, maxLosses, enabled);
  const hz50 = useDifferSymbol("1HZ50V", "Vol 50 (1s)", baseStake, maxLosses, enabled);
  const hz75 = useDifferSymbol("1HZ75V", "Vol 75 (1s)", baseStake, maxLosses, enabled);
  const hz100 = useDifferSymbol("1HZ100V", "Vol 100 (1s)", baseStake, maxLosses, enabled);

  const markets: DifferMarket[] = [r10, r25, r50, r75, r100, hz10, hz25, hz50, hz75, hz100];

  const allTrades = markets
    .flatMap((m) => m.trades)
    .sort((a, b) => b.epoch - a.epoch)
    .slice(0, 120);

  const activeCount = markets.filter((m) => m.status === "watching" || m.status === "recovering").length;
  const recoveringCount = markets.filter((m) => m.status === "recovering").length;
  const maxedOutCount = markets.filter((m) => m.status === "max-losses").length;
  const readyCount = markets.filter((m) => m.tickCount >= DIFFER_WINDOW).length;
  const liveCount = markets.filter((m) => m.wsStatus === "open").length;

  return {
    markets,
    allTrades,
    activeCount,
    recoveringCount,
    maxedOutCount,
    readyCount,
    liveCount,
  };
}
