/**
 * Dedicated OAuth callback page — registered as the redirect_uri with Deriv.
 *
 * After the user authorises on oauth.deriv.com, Deriv redirects here with:
 *   /callback?acct1=CR123&token1=xxx&cur1=USD&acct2=VRTC456&token2=yyy&state=<nonce>
 *
 * Redirect URI to register in the Deriv app dashboard:
 *   https://<your-domain>/callback
 *
 * Deriv app registration (new interface — not legacy binary.com):
 *   https://app.deriv.com/account/apps-and-api
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getListAccountsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";

const DERIV_OAUTH_STATE_KEY = "deriv_oauth_state";

type PendingToken = { loginid: string; token: string };

function parseCallbackParams(): { tokens: PendingToken[]; state: string | null } {
  const params = new URLSearchParams(window.location.search);
  const tokens: PendingToken[] = [];
  let i = 1;
  while (params.has(`acct${i}`) && params.has(`token${i}`)) {
    tokens.push({
      loginid: params.get(`acct${i}`)!,
      token:   params.get(`token${i}`)!,
    });
    i++;
  }
  return { tokens, state: params.get("state") };
}

type Status =
  | { kind: "processing"; progress: string }
  | { kind: "success";    count: number }
  | { kind: "error";      message: string };

export default function OAuthCallback() {
  const [status, setStatus] = useState<Status>({ kind: "processing", progress: "Verifying…" });
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  useEffect(() => {
    const { tokens, state } = parseCallbackParams();

    // Strip params from the URL so a reload doesn't re-submit.
    window.history.replaceState({}, "", window.location.pathname);

    // Clean up any stored state nonce (best-effort).
    localStorage.removeItem(DERIV_OAUTH_STATE_KEY);

    // Note: Deriv enforces the redirect_uri on their side — only our registered
    // /callback URL ever receives tokens. We skip our own nonce check here
    // because the nonce can be lost across iframe/top-frame boundaries in
    // some browser environments, which would block legitimate logins.

    if (tokens.length === 0) {
      setStatus({
        kind:    "error",
        message: "No accounts were returned by Deriv. Please try logging in again.",
      });
      return;
    }

    // ── 2. Connect each account via the API ────────────────────────────────
    setStatus({
      kind:     "processing",
      progress: `Connecting ${tokens.length} account${tokens.length > 1 ? "s" : ""}…`,
    });

    const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

    Promise.allSettled(
      tokens.map(async ({ loginid, token }) => {
        const res = await fetch(`${apiBase}/api/accounts`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ label: loginid, apiToken: token }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err?.error ?? `Failed to connect ${loginid}`);
        }
        return res.json();
      }),
    ).then((results) => {
      const failed  = results.filter((r) => r.status === "rejected");
      const success = results.filter((r) => r.status === "fulfilled");

      qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });

      if (failed.length > 0 && success.length === 0) {
        const reason = (failed[0] as PromiseRejectedResult).reason as Error;
        setStatus({ kind: "error", message: reason?.message ?? "Could not connect accounts." });
        return;
      }

      setStatus({ kind: "success", count: success.length });

      // Brief pause so the user sees the ✓ before navigating.
      setTimeout(() => navigate("/accounts"), 1200);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">

        {/* RAYZPRO wordmark */}
        <span className="text-xl font-bold tracking-widest text-primary">RAYZPRO</span>

        {status.kind === "processing" && (
          <>
            <div className="h-14 w-14 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{status.progress}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Connecting your Deriv account…
              </p>
            </div>
          </>
        )}

        {status.kind === "success" && (
          <>
            <div className="h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-emerald-400">
                {status.count} account{status.count > 1 ? "s" : ""} connected!
              </p>
              <p className="text-xs text-muted-foreground mt-1">Redirecting you now…</p>
            </div>
          </>
        )}

        {status.kind === "error" && (
          <>
            <div className="h-14 w-14 rounded-full bg-destructive/15 flex items-center justify-center">
              <svg className="h-7 w-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Login failed</p>
              <p className="text-xs text-muted-foreground mt-1">{status.message}</p>
            </div>
            <button
              onClick={() => navigate("/accounts")}
              className="mt-2 text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              Go to Accounts →
            </button>
          </>
        )}

      </div>
    </div>
  );
}
