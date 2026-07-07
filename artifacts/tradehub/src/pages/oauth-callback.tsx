/**
 * OAuth callback page — registered as redirect_uri in the Deriv developer portal.
 *
 * After the user authorises on Deriv's website, Deriv redirects here with:
 *   /callback?code=<auth_code>          ← new PKCE flow
 *   /callback?acct1=CR…&token1=xxx…    ← old implicit flow (fallback)
 *
 * This page runs in the NEW TAB that was opened by the accounts page.
 * After a successful exchange it:
 *   1. Writes "deriv_oauth_done" to localStorage  → fires `storage` event
 *      in the original tab so it refreshes automatically.
 *   2. Tries postMessage to window.opener          → immediate notification.
 *   3. Tries window.close()                        → closes this tab.
 *   4. Falls back to navigating to /accounts       → if the tab can't close.
 *
 * Redirect URL to register in Deriv developer portal:
 *   https://<your-domain>/callback
 */

import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getListAccountsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";

const DERIV_PKCE_VERIFIER_KEY = "deriv_pkce_verifier";
const DERIV_PKCE_REDIRECT_KEY = "deriv_pkce_redirect";
const DERIV_OAUTH_DONE_KEY    = "deriv_oauth_done";

type Status =
  | { kind: "processing"; progress: string }
  | { kind: "success";    count: number }
  | { kind: "error";      message: string; detail?: string };

/** Signal success to the opener tab, then close this tab. */
function signalAndClose(count: number) {
  const payload = JSON.stringify({ count, ts: Date.now() });

  // 1. localStorage storage event → picked up by any open tab on same origin
  try { localStorage.setItem(DERIV_OAUTH_DONE_KEY, payload); } catch { /* noop */ }

  // 2. postMessage → immediate notification to the opener window (if any)
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: "deriv_oauth_success", count },
        window.location.origin,
      );
    }
  } catch { /* cross-origin or blocked */ }

  // 3. Close this tab (works when opened via window.open without noopener)
  try { window.close(); } catch { /* noop */ }
}

export default function OAuthCallback() {
  const [status, setStatus] = useState<Status>({ kind: "processing", progress: "Reading authorisation response…" });
  const [, navigate]        = useLocation();
  const qc                  = useQueryClient();
  const ranRef              = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params  = new URLSearchParams(window.location.search);
    window.history.replaceState({}, "", window.location.pathname);

    const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

    const code   = params.get("code");
    const token1 = params.get("token1");

    // ── Error from Deriv ─────────────────────────────────────────────────────
    if (!code && !token1) {
      const msg = params.get("error_description") ?? params.get("error");
      setStatus({
        kind:    "error",
        message: msg ?? "No authorisation data returned by Deriv.",
        detail:  msg
          ? undefined
          : "Make sure your Redirect URL is registered correctly in the Deriv developer portal.",
      });
      return;
    }

    // ── Path A: PKCE flow (?code=…) ──────────────────────────────────────────
    if (code) {
      const codeVerifier = localStorage.getItem(DERIV_PKCE_VERIFIER_KEY);
      const redirectUri  = localStorage.getItem(DERIV_PKCE_REDIRECT_KEY);
      localStorage.removeItem(DERIV_PKCE_VERIFIER_KEY);
      localStorage.removeItem(DERIV_PKCE_REDIRECT_KEY);

      if (!codeVerifier || !redirectUri) {
        setStatus({
          kind:    "error",
          message: "Session expired — PKCE verifier not found.",
          detail:  "The login flow timed out or you opened the callback in a different browser. Please try logging in again.",
        });
        return;
      }

      setStatus({ kind: "processing", progress: "Exchanging code for tokens…" });

      fetch(`${apiBase}/api/oauth/exchange`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code, codeVerifier, redirectUri }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(err?.error ?? `Token exchange failed (HTTP ${res.status})`);
          }
          return res.json() as Promise<{ count: number }>;
        })
        .then(({ count }) => {
          qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setStatus({ kind: "success", count });
          signalAndClose(count);
          // If the tab is still open after 2 s, navigate to accounts
          setTimeout(() => navigate("/accounts"), 2000);
        })
        .catch((err: Error) => {
          setStatus({ kind: "error", message: err.message });
        });

      return;
    }

    // ── Path B: Old implicit flow (?acct1=…&token1=…) ────────────────────────
    setStatus({ kind: "processing", progress: "Connecting accounts…" });

    const accounts: Array<{ loginid: string; token: string }> = [];
    for (let n = 1; ; n++) {
      const loginid = params.get(`acct${n}`);
      const token   = params.get(`token${n}`);
      if (!loginid || !token) break;
      accounts.push({ loginid, token });
    }

    if (accounts.length === 0) {
      setStatus({ kind: "error", message: "No account tokens returned by Deriv." });
      return;
    }

    fetch(`${apiBase}/api/oauth/tokens`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ accounts }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err?.error ?? `Account save failed (HTTP ${res.status})`);
        }
        return res.json() as Promise<{ count: number }>;
      })
      .then(({ count }) => {
        qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setStatus({ kind: "success", count });
        signalAndClose(count);
        setTimeout(() => navigate("/accounts"), 2000);
      })
      .catch((err: Error) => {
        setStatus({ kind: "error", message: err.message });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">

        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-widest text-primary font-mono">RAYZPRO</span>
        </div>

        {/* Processing */}
        {status.kind === "processing" && (
          <>
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-primary/10 border-b-primary/40 animate-spin [animation-direction:reverse] [animation-duration:1.4s]" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground font-mono">{status.progress}</p>
              <p className="text-xs text-muted-foreground font-mono">Connecting your Deriv account…</p>
            </div>
          </>
        )}

        {/* Success */}
        {status.kind === "success" && (
          <>
            <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center animate-in zoom-in duration-300">
              <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-semibold text-emerald-400 font-mono">
                {status.count} account{status.count !== 1 ? "s" : ""} connected!
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                This tab will close automatically…
              </p>
            </div>
          </>
        )}

        {/* Error */}
        {status.kind === "error" && (
          <>
            <div className="h-16 w-16 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center">
              <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="text-center space-y-2 max-w-xs">
              <p className="text-sm font-semibold text-foreground font-mono">Login failed</p>
              <p className="text-xs text-destructive/80 font-mono leading-relaxed">{status.message}</p>
              {status.detail && (
                <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">{status.detail}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate("/accounts")}
                className="font-mono text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                ← Back to Accounts
              </button>
              <button
                onClick={() => { window.location.href = "/accounts"; }}
                className="font-mono text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Try again
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
