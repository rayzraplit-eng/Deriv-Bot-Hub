import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import Accounts from "@/pages/accounts";
import BotsList from "@/pages/bots";
import BotDetail from "@/pages/bots/[id]";
import ToolsList from "@/pages/tools";
import MartingaleTool from "@/pages/tools/martingale";
import RiskTool from "@/pages/tools/risk";
import CompoundTool from "@/pages/tools/compound";
import Journal from "@/pages/journal";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/accounts" component={Accounts} />
        <Route path="/bots" component={BotsList} />
        <Route path="/bots/:id" component={BotDetail} />
        <Route path="/tools" component={ToolsList} />
        <Route path="/tools/martingale" component={MartingaleTool} />
        <Route path="/tools/risk" component={RiskTool} />
        <Route path="/tools/compound" component={CompoundTool} />
        <Route path="/journal" component={Journal} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
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
