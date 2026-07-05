import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TabbedApp } from "@/components/layout/TabbedApp";
import { AppShell } from "@/components/layout/AppShell";
import NotFound from "@/pages/not-found";
import { useToast } from "@/hooks/use-toast";

import Accounts from "@/pages/accounts";
import BotsList from "@/pages/bots";
import BotDetail from "@/pages/bots/[id]";
import ToolsList from "@/pages/tools";
import MartingaleTool from "@/pages/tools/martingale";
import RiskTool from "@/pages/tools/risk";
import CompoundTool from "@/pages/tools/compound";
import { getListAccountsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";

const queryClient = new QueryClient();

// ── Deriv OAuth callback handler ──────────────────────────────────────────────
// After the full-page redirect, Deriv lands back here with:
//   ?acct1=CR123&token1=xxx&acct2=VRTC456&token2=yyy&state=<nonce>
// We verify the state nonce, connect each account via the API, then redirect
// to /accounts so the user immediately sees their connected accounts.

const DERIV_OAUTH_STATE_KEY = "deriv_oauth_state";

type PendingToken = { loginid: string; token: string };

function parseDerivOAuthParams(): { tokens: PendingToken[]; state: string | null } {
  const params = new URLSearchParams(window.location.search);
  const tokens: PendingToken[] = [];
  let i = 1;
  while (params.has(`acct${i}`) && params.has(`token${i}`)) {
    tokens.push({ loginid: params.get(`acct${i}`)!, token: params.get(`token${i}`)! });
    i++;
  }
  return { tokens, state: params.get("state") };
}

function OAuthCallbackHandler({ children }: { children: React.ReactNode }) {
  const [handling, setHandling] = useState<boolean | null>(null); // null = still detecting
  const [progress, setProgress] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  useEffect(() => {
    const { tokens, state } = parseDerivOAuthParams();
    if (tokens.length === 0) {
      setHandling(false);
      return;
    }

    // Strip OAuth params from the URL immediately so a page reload doesn't
    // re-trigger this and attempt to re-connect already-saved accounts.
    window.history.replaceState({}, "", window.location.pathname);

    // Verify the state nonce to prevent CSRF / crafted-callback attacks.
    const expectedState = sessionStorage.getItem(DERIV_OAUTH_STATE_KEY);
    sessionStorage.removeItem(DERIV_OAUTH_STATE_KEY);
    if (!state || state !== expectedState) {
      toast({
        title: "Login failed",
        description: "Invalid OAuth state — please try logging in again.",
        variant: "destructive",
      });
      setHandling(false);
      return;
    }

    setHandling(true);
    setProgress(`Connecting ${tokens.length} Deriv account${tokens.length > 1 ? "s" : ""}…`);

    const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

    Promise.allSettled(
      tokens.map(async ({ loginid, token }) => {
        const res = await fetch(`${apiBase}/api/accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: loginid, apiToken: token }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err?.error ?? `Failed to connect ${loginid}`);
        }
        return res.json();
      }),
    ).then((results) => {
      const failed = results.filter((r) => r.status === "rejected");

      qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });

      if (failed.length === 0) {
        toast({ title: `${tokens.length} Deriv account${tokens.length > 1 ? "s" : ""} connected!` });
      } else if (failed.length < tokens.length) {
        toast({
          title: "Some accounts connected",
          description: `${tokens.length - failed.length} connected, ${failed.length} failed`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Could not connect accounts",
          description: (failed[0] as PromiseRejectedResult).reason?.message,
          variant: "destructive",
        });
      }

      // Redirect to the Accounts page so users immediately see their accounts.
      navigate("/accounts");
      setHandling(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (handling === null || handling === true) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <div className="h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="font-mono text-sm text-muted-foreground">
          {progress || "Connecting your Deriv account…"}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

function Router() {
  return (
    <OAuthCallbackHandler>
      <Switch>
        <Route path="/" component={TabbedApp} />
        <Route path="/accounts">
          <AppShell><Accounts /></AppShell>
        </Route>
        <Route path="/bots">
          <AppShell><BotsList /></AppShell>
        </Route>
        <Route path="/bots/:id">
          <AppShell><BotDetail /></AppShell>
        </Route>
        <Route path="/tools">
          <AppShell><ToolsList /></AppShell>
        </Route>
        <Route path="/tools/martingale">
          <AppShell><MartingaleTool /></AppShell>
        </Route>
        <Route path="/tools/risk">
          <AppShell><RiskTool /></AppShell>
        </Route>
        <Route path="/tools/compound">
          <AppShell><CompoundTool /></AppShell>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </OAuthCallbackHandler>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
