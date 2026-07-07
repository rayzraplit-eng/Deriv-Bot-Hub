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
  | { kind: "error";      message: string; detail?: string; debugParams?: Record<string, string> };

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
      // Collect ALL query params for debugging — whatever Deriv sent
      const allParams: Record<string, string> = {};
      params.forEach((v, k) => { allParams[k] = v; });
      const paramCount = Object.keys(allParams).length;

      const derivError       = params.get("error");
      const derivDescription = params.get("error_description");
      const hasDerivError    = Boolean(derivError || derivDescription);

      setStatus({
        kind:    "error",
        message: derivDescription ?? derivError ?? "No authorisation data returned by Deriv.",
        detail:  hasDerivError
          ? undefined
          : paramCount === 0
            ? "Deriv redirected here without any parameters. The Redirect URL registered in the Deriv developer portal must exactly match the URL shown in the Accounts page."
            : `Unknown response — ${paramCount} param(s) received: ${JSON.stringify(allParams)}`,
        debugParams: allParams,
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

            <div className="w-full max-w-xs space-y-3">
              <p className="text-sm font-semibold text-foreground font-mono text-center">Login failed</p>
              <p className="text-xs text-destructive/80 font-mono leading-relaxed text-center">{status.message}</p>
              {status.detail && (
                <p className="text-[11px] text-muted-foreground font-mono leading-relaxed text-center">{status.detail}</p>
              )}

              {/* Required redirect URL — what to register on developers.deriv.com */}
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
                <p className="text-[10px] font-mono text-amber-400 font-semibold uppercase tracking-wider">
                  Register this exact URL on developers.deriv.com:
                </p>
                <code className="text-[11px] font-mono text-foreground/90 break-all select-all leading-relaxed block">
                  {`${window.location.origin}/callback`}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/callback`)}
                  className="text-[10px] font-mono text-amber-400 underline underline-offset-2"
                >
                  Copy
                </button>
              </div>

              {/* Debug params — shows exactly what Deriv sent back */}
              {status.debugParams && Object.keys(status.debugParams).length > 0 && (
                <div className="rounded border border-border/40 bg-muted/20 p-3">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">
                    Params Deriv sent:
                  </p>
                  {Object.entries(status.debugParams).map(([k, v]) => (
                    <div key={k} className="text-[10px] font-mono flex gap-1">
                      <span className="text-primary shrink-0">{k}:</span>
                      <span className="text-foreground/70 break-all">{v}</span>
                    </div>
                  ))}
                </div>
              )}
              {status.debugParams && Object.keys(status.debugParams).length === 0 && (
                <p className="text-[10px] font-mono text-muted-foreground/50 text-center">
                  (No URL parameters — Deriv sent no data)
                </p>
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
