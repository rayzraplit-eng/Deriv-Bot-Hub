import WebSocket from "ws";

const DERIV_WS_URL = "wss://ws.derivws.com/websockets/v3?app_id=1089";
const TIMEOUT_MS = 12_000;

export interface DerivAccountInfo {
  loginid: string;
  email: string | null;
  country: string | null;
  currency: string;
  accountType: string;
  balance: number;
}

export class DerivAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DerivAuthError";
  }
}

export async function fetchDerivAccountInfo(token: string): Promise<DerivAccountInfo> {
  return new Promise<DerivAccountInfo>((resolve, reject) => {
    const ws = new WebSocket(DERIV_WS_URL);
    let timeout: NodeJS.Timeout;
    let settled = false;

    const cleanup = (): void => {
      if (timeout) clearTimeout(timeout);
      try {
        ws.close();
      } catch {
        /* noop */
      }
    };

    const finish = (err: Error | null, value?: DerivAccountInfo): void => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) reject(err);
      else if (value) resolve(value);
    };

    timeout = setTimeout(() => {
      finish(new DerivAuthError("Timed out connecting to Deriv"));
    }, TIMEOUT_MS);

    let authorize: Record<string, unknown> | null = null;

    ws.on("open", () => {
      ws.send(JSON.stringify({ authorize: token, req_id: 1 }));
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (msg.error) {
          const err = msg.error as { message?: string };
          finish(new DerivAuthError(err.message ?? "Authorization failed"));
          return;
        }

        if (msg.msg_type === "authorize") {
          authorize = msg.authorize as Record<string, unknown>;
          ws.send(JSON.stringify({ balance: 1, req_id: 2 }));
          return;
        }

        if (msg.msg_type === "balance" && authorize) {
          const balanceObj = msg.balance as { balance?: number; currency?: string };
          const accountType =
            (authorize["is_virtual"] === 1 || authorize["is_virtual"] === true)
              ? "demo"
              : "real";
          finish(null, {
            loginid: String(authorize["loginid"] ?? ""),
            email: (authorize["email"] as string | undefined) ?? null,
            country: (authorize["country"] as string | undefined) ?? null,
            currency:
              (balanceObj?.currency as string | undefined) ??
              (authorize["currency"] as string | undefined) ??
              "USD",
            accountType,
            balance:
              typeof balanceObj?.balance === "number"
                ? balanceObj.balance
                : Number(authorize["balance"] ?? 0),
          });
          return;
        }
      } catch (err) {
        finish(err as Error);
      }
    });

    ws.on("error", (err) => {
      finish(err as Error);
    });

    ws.on("close", () => {
      if (!settled) {
        finish(new DerivAuthError("Connection closed before authorization completed"));
      }
    });
  });
}
