/**
 * Dedicated OAuth callback page — registered as redirect_uri with Deriv.
 *
 * Deriv's new API uses Authorization Code + PKCE. After the user authorises,
 * Deriv redirects here with:
 *   /callback?code=<auth-code>&state=<state>
 *
 * We exchange the code at the backend (POST /api/oauth/exchange), which calls
 * Deriv's token endpoint, then authorises via WebSocket to fetch all account
 * tokens from the `account_list` field of the `authorize` response.
 *
 * Redirect URI to register in Deriv app dashboard:
 *   https://<your-domain>/callback
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getListAccountsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";

const DERIV_PKCE_VERIFIER_KEY = "deriv_pkce_verifier";
const DERIV_PKCE_REDIRECT_KEY  = "deriv_pkce_redirect";

type Status =
  | { kind: "processing"; progress: string }
  | { kind: "success";    count: number }
  | { kind: "error";      message: string };

export default function OAuthCallback() {
  const [status, setStatus]   = useState<Status>({ kind: "processing", progress: "Reading authorisation code…" });
  const [, navigate]          = useLocation();
  const qc                    = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Strip params from the URL immediately so a page reload doesn't re-trigger.
    window.history.replaceState({}, "", window.location.pathname);

    const code = params.get("code");

    if (!code) {
      // Deriv returned an error or the URL is malformed.
      const errDesc = params.get("error_description") ?? params.get("error") ?? "No authorisation code returned.";
      setStatus({ kind: "error", message: errDesc });
      return;
    }

    // Retrieve the PKCE verifier + redirect URI stored before the redirect.
    const codeVerifier = localStorage.getItem(DERIV_PKCE_VERIFIER_KEY);
    const redirectUri  = localStorage.getItem(DERIV_PKCE_REDIRECT_KEY);
    localStorage.removeItem(DERIV_PKCE_VERIFIER_KEY);
    localStorage.removeItem(DERIV_PKCE_REDIRECT_KEY);

    if (!codeVerifier || !redirectUri) {
      setStatus({
        kind:    "error",
        message: "PKCE verifier missing — please try logging in again.",
      });
      return;
    }

    setStatus({ kind: "processing", progress: "Exchanging code for tokens…" });

    const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

    fetch(`${apiBase}/api/oauth/exchange`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ code, codeVerifier, redirectUri }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err?.error ?? `Token exchange failed (${res.status})`);
        }
        return res.json() as Promise<{ count: number }>;
      })
      .then(({ count }) => {
        qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setStatus({ kind: "success", count });
        setTimeout(() => navigate("/accounts"), 1200);
      })
      .catch((err: Error) => {
        setStatus({ kind: "error", message: err.message });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">

        <span className="text-xl font-bold tracking-widest text-primary">RAYZPRO</span>

        {status.kind === "processing" && (
          <>
            <div className="h-14 w-14 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{status.progress}</p>
              <p className="text-xs text-muted-foreground mt-1">Connecting your Deriv account…</p>
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
                {status.count} account{status.count !== 1 ? "s" : ""} connected!
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
