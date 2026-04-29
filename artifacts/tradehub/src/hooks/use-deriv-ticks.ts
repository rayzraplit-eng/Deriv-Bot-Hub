import { useEffect, useRef, useState } from "react";

export type DerivTick = {
  symbol: string;
  quote: number;
  pip_size: number;
  epoch: number;
};

export type DerivTickStatus = "connecting" | "open" | "closed" | "error";

const DERIV_WS_URL = "wss://ws.derivws.com/websockets/v3?app_id=1089";

type Subscriber = (tick: DerivTick) => void;
type Connection = {
  ws: WebSocket;
  subId: string | null;
  refCount: number;
  subscribers: Set<Subscriber>;
  statusSubscribers: Set<(s: DerivTickStatus) => void>;
  status: DerivTickStatus;
  reconnectTimer: number | null;
};

const connections = new Map<string, Connection>();

function setStatus(conn: Connection, status: DerivTickStatus) {
  conn.status = status;
  conn.statusSubscribers.forEach((cb) => cb(status));
}

function openConnection(symbol: string): Connection {
  const ws = new WebSocket(DERIV_WS_URL);
  const conn: Connection = {
    ws,
    subId: null,
    refCount: 0,
    subscribers: new Set(),
    statusSubscribers: new Set(),
    status: "connecting",
    reconnectTimer: null,
  };

  ws.addEventListener("open", () => {
    setStatus(conn, "open");
    ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
  });

  ws.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg?.msg_type === "tick" && msg.tick) {
        if (msg.subscription?.id) conn.subId = msg.subscription.id;
        const tick: DerivTick = {
          symbol: msg.tick.symbol,
          quote: Number(msg.tick.quote),
          pip_size: Number(msg.tick.pip_size ?? 2),
          epoch: Number(msg.tick.epoch ?? Math.floor(Date.now() / 1000)),
        };
        conn.subscribers.forEach((cb) => cb(tick));
      }
    } catch {
      /* ignore */
    }
  });

  const scheduleReconnect = () => {
    if (conn.reconnectTimer !== null) return;
    conn.reconnectTimer = window.setTimeout(() => {
      conn.reconnectTimer = null;
      connections.delete(symbol);
      if (conn.subscribers.size > 0) {
        const next = openConnection(symbol);
        next.refCount = conn.refCount;
        conn.subscribers.forEach((s) => next.subscribers.add(s));
        conn.statusSubscribers.forEach((s) => next.statusSubscribers.add(s));
        connections.set(symbol, next);
      }
    }, 2000);
  };

  ws.addEventListener("close", () => {
    setStatus(conn, "closed");
    scheduleReconnect();
  });

  ws.addEventListener("error", () => {
    setStatus(conn, "error");
  });

  return conn;
}

function getConnection(symbol: string): Connection {
  let conn = connections.get(symbol);
  if (!conn) {
    conn = openConnection(symbol);
    connections.set(symbol, conn);
  }
  return conn;
}

function releaseConnection(symbol: string, subscriber: Subscriber, statusCb: (s: DerivTickStatus) => void) {
  const conn = connections.get(symbol);
  if (!conn) return;
  conn.subscribers.delete(subscriber);
  conn.statusSubscribers.delete(statusCb);
  conn.refCount = Math.max(0, conn.refCount - 1);
  if (conn.refCount === 0) {
    if (conn.reconnectTimer !== null) {
      window.clearTimeout(conn.reconnectTimer);
      conn.reconnectTimer = null;
    }
    try {
      if (conn.ws.readyState === WebSocket.OPEN && conn.subId) {
        conn.ws.send(JSON.stringify({ forget: conn.subId }));
      }
      conn.ws.close();
    } catch {
      /* ignore */
    }
    connections.delete(symbol);
  }
}

export type UseDerivTicksOptions = {
  bufferSize?: number;
  enabled?: boolean;
};

export function useDerivTicks(symbol: string, options: UseDerivTicksOptions = {}) {
  const bufferSize = options.bufferSize ?? 1000;
  const enabled = options.enabled !== false;

  const [ticks, setTicks] = useState<DerivTick[]>([]);
  const [status, setStatusState] = useState<DerivTickStatus>("connecting");
  const bufferRef = useRef<DerivTick[]>([]);

  useEffect(() => {
    if (!enabled || !symbol) return;
    bufferRef.current = [];
    setTicks([]);

    const onTick: Subscriber = (tick) => {
      if (tick.symbol !== symbol) return;
      const next = [...bufferRef.current, tick];
      if (next.length > bufferSize) next.splice(0, next.length - bufferSize);
      bufferRef.current = next;
      setTicks(next);
    };

    const onStatus = (s: DerivTickStatus) => setStatusState(s);

    const conn = getConnection(symbol);
    conn.subscribers.add(onTick);
    conn.statusSubscribers.add(onStatus);
    conn.refCount += 1;
    setStatusState(conn.status);

    return () => {
      releaseConnection(symbol, onTick, onStatus);
    };
  }, [symbol, enabled, bufferSize]);

  const last = ticks[ticks.length - 1];
  const prev = ticks[ticks.length - 2];
  const direction: "up" | "down" | "flat" = !last || !prev ? "flat" : last.quote > prev.quote ? "up" : last.quote < prev.quote ? "down" : "flat";

  return { ticks, status, last, direction };
}
