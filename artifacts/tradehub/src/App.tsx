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
// Deriv redirects back with: ?acct1=CR123&token1=xxx&acct2=VRTC456&token2=yyy
// We parse those, connect each account via the API, then clean the URL.

type PendingToken = { loginid: string; token: string };

function parseDrivOAuthParams(): PendingToken[] {
  const params = new URLSearchParams(window.location.search);
  const tokens: PendingToken[] = [];
  let i = 1;
  while (params.has(`acct${i}`) && params.has(`token${i}`)) {
    tokens.push({ loginid: params.get(`acct${i}`)!, token: params.get(`token${i}`)! });
    i++;
  }
  return tokens;
}

// When Deriv's OAuth redirects back inside our popup window (opened by
// loginWithDeriv in accounts.tsx), this window has `window.opener` pointing
// at the original RAYZPRO tab. We finish connecting the account(s) here,
// then notify the opener via postMessage and close ourselves — the user
// never has to leave the tab they started on.
const isOAuthPopup = typeof window !== "undefined" && !!window.opener && window.opener !== window;

const DERIV_OAUTH_MESSAGE = "rayzpro-deriv-oauth";

function OAuthCallbackHandler({ children }: { children: React.ReactNode }) {
  const [handling, setHandling] = useState<boolean | null>(null); // null=detecting
  const [progress, setProgress] = useState("");
  const [popupDone, setPopupDone] = useState(false);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  // Main-tab side: listen for the popup telling us it finished connecting.
  useEffect(() => {
    if (isOAuthPopup) return;
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== DERIV_OAUTH_MESSAGE) return;
      qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      if (event.data.status === "success") {
        toast({ title: `${event.data.count} Deriv account${event.data.count > 1 ? "s" : ""} connected!` });
      } else {
        toast({ title: "Could not connect accounts", description: event.data.message, variant: "destructive" });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [qc, toast]);

  useEffect(() => {
    const tokens = parseDrivOAuthParams();
    if (tokens.length === 0) {
      setHandling(false);
      return;
    }

    // Remove OAuth params from URL immediately so reloads don't re-trigger
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);

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

      if (isOAuthPopup && window.opener) {
        // Tell the original tab what happened, then close this popup.
        window.opener.postMessage(
          failed.length === 0
            ? { source: DERIV_OAUTH_MESSAGE, status: "success", count: tokens.length }
            : { source: DERIV_OAUTH_MESSAGE, status: "error", message: (failed[0] as PromiseRejectedResult).reason?.message ?? "Failed to connect account" },
          window.location.origin,
        );
        setPopupDone(true);
        setTimeout(() => window.close(), 800);
        return;
      }

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
        toast({ title: "Could not connect accounts", description: (failed[0] as PromiseRejectedResult).reason?.message, variant: "destructive" });
      }

      setHandling(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isOAuthPopup && (handling === null || handling === true || popupDone)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <div className="h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="font-mono text-sm text-muted-foreground">
          {popupDone ? "Connected! Closing this window…" : (progress || "Checking Deriv session…")}
        </p>
      </div>
    );
  }

  if (handling === null || handling === true) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <div className="h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="font-mono text-sm text-muted-foreground">
          {progress || "Checking Deriv session…"}
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
