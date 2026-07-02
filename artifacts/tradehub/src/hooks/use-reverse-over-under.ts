import { useEffect, useRef, useState } from "react";
import { useDerivTicks } from "./use-deriv-ticks";
import { getLastDigit } from "./use-master-trader";

export type RouStatus = "idle" | "buffering" | "watching" | "trading";

export type RouMode   = "over" | "under";
export type RouPhase  = "entry" | "recovery";
export type RouTradeType = "over2" | "over4" | "under7" | "under5";

export type RouTrade = {
  id:          string;
  type:        RouTradeType;
  stake:       number;
  result:      "win" | "loss";
  actualDigit: number;
  epoch:       number;
};

type InternalRef = {
  status:            RouStatus;
  prevDigit:         number | null;
  mode:              RouMode | null;
  phase:             RouPhase;
  tradeActive:       boolean;
  ticksSinceTrade:   number;
  currentStake:      number;
  consecutiveLosses: number;
  lastEpoch:         number;
};

const MARTINGALE   = 1.8;
const TICKS_WINDOW = 2;

// Over 2 win: digit > 2   (digits 3-9 = 7/10 = 70%)
// Over 4 win: digit > 4   (digits 5-9 = 5/10 = 50%)
// Under 7 win: digit < 7  (digits 0-6 = 7/10 = 70%)
// Under 5 win: digit < 5  (digits 0-4 = 5/10 = 50%)
function isWin(type: RouTradeType, digit: number): boolean {
  if (type === "over2")  return digit > 2;
  if (type === "over4")  return digit > 4;
  if (type === "under7") return digit < 7;
  return digit < 5; // under5
}

function tradeType(mode: RouMode, phase: RouPhase): RouTradeType {
  if (mode === "over")  return phase === "entry" ? "over2"  : "over4";
  return                       phase === "entry" ? "under7" : "under5";
}

export function useReverseOverUnder(
  symbol:    string,
  baseStake: number,
  enabled:   boolean,
) {
  const { ticks, status: wsStatus } = useDerivTicks(symbol, {
    bufferSize: 300,
    enabled,
  });

  const [status,            setStatus]            = useState<RouStatus>("idle");
  const [mode,              setMode]              = useState<RouMode | null>(null);
  const [phase,             setPhase]             = useState<RouPhase>("entry");
  const [currentStake,      setCurrentStake]      = useState(baseStake);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [trades,            setTrades]            = useState<RouTrade[]>([]);
  const [recentDigits,      setRecentDigits]      = useState<number[]>([]);

  const ref = useRef<InternalRef>({
    status:            "idle",
    prevDigit:         null,
    mode:              null,
    phase:             "entry",
    tradeActive:       false,
    ticksSinceTrade:   0,
    currentStake:      baseStake,
    consecutiveLosses: 0,
    lastEpoch:         0,
  });

  // Reset when disabled
  useEffect(() => {
    if (enabled) return;
    ref.current = {
      status:            "idle",
      prevDigit:         null,
      mode:              null,
      phase:             "entry",
      tradeActive:       false,
      ticksSinceTrade:   0,
      currentStake:      baseStake,
      consecutiveLosses: 0,
      lastEpoch:         0,
    };
    setStatus("idle");
    setMode(null);
    setPhase("entry");
    setCurrentStake(baseStake);
    setConsecutiveLosses(0);
    setTrades([]);
    setRecentDigits([]);
  }, [enabled, baseStake]);

  useEffect(() => {
    if (!enabled) return;
    if (ticks.length < 2) {
      if (ref.current.status !== "buffering") {
        ref.current.status = "buffering";
        setStatus("buffering");
      }
      return;
    }

    const r         = ref.current;
    const lastTick  = ticks[ticks.length - 1]!;
    if (lastTick.epoch === r.lastEpoch) return;
    r.lastEpoch = lastTick.epoch;

    const digit   = getLastDigit(lastTick);
    const recent  = ticks.slice(-12).map(getLastDigit);
    setRecentDigits(recent);

    // Transition to watching on first live tick
    if (r.status === "idle" || r.status === "buffering") {
      r.status = "watching";
      setStatus("watching");
    }

    if (!r.tradeActive) {
      // ── Pattern detection ────────────────────────────────────────────────
      const prev = r.prevDigit;
      r.prevDigit = digit;

      if (prev !== null) {
        const overTrigger  = (prev === 8 || prev === 9) && (digit === 0 || digit === 1 || digit === 2);
        const underTrigger = (prev === 0 || prev === 1) && (digit === 7 || digit === 8 || digit === 9);

        if (overTrigger || underTrigger) {
          r.mode           = overTrigger ? "over" : "under";
          r.phase          = "entry";
          r.tradeActive    = true;
          r.ticksSinceTrade = 0;
          r.status         = "trading";
          setMode(r.mode);
          setPhase("entry");
          setStatus("trading");
        }
      }
    } else {
      // ── Active trade: count ticks ─────────────────────────────────────────
      r.ticksSinceTrade++;

      if (r.ticksSinceTrade >= TICKS_WINDOW) {
        r.ticksSinceTrade = 0;

        const type = tradeType(r.mode!, r.phase);
        const win  = isWin(type, digit);

        const trade: RouTrade = {
          id:          `${lastTick.epoch}-${Math.random().toString(36).slice(2)}`,
          type,
          stake:       r.currentStake,
          result:      win ? "win" : "loss",
          actualDigit: digit,
          epoch:       lastTick.epoch,
        };
        setTrades((prev) => [trade, ...prev].slice(0, 60));

        if (win) {
          // Reset to watching after win
          r.tradeActive       = false;
          r.mode              = null;
          r.phase             = "entry";
          r.currentStake      = baseStake;
          r.consecutiveLosses = 0;
          r.status            = "watching";
          setMode(null);
          setPhase("entry");
          setCurrentStake(baseStake);
          setConsecutiveLosses(0);
          setStatus("watching");
        } else {
          // Loss — switch to / stay in recovery with 1.8× martingale
          r.consecutiveLosses++;
          r.currentStake      = parseFloat((r.currentStake * MARTINGALE).toFixed(2));
          r.phase             = "recovery";
          r.tradeActive       = true;
          r.ticksSinceTrade   = 0;
          setPhase("recovery");
          setCurrentStake(r.currentStake);
          setConsecutiveLosses(r.consecutiveLosses);
        }
      }
    }
  }, [ticks, enabled, baseStake]);

  const currentType = mode ? tradeType(mode, phase) : null;

  return {
    status,
    wsStatus,
    mode,
    phase,
    currentType,
    currentStake,
    consecutiveLosses,
    trades,
    recentDigits,
    tickCount: ticks.length,
  };
}
