import { useState, useRef } from "react";
import { LayoutDashboard, Brain, BarChart2, Hand, BookOpen, Zap } from "lucide-react";
import { useListAccounts } from "@workspace/api-client-react";
import { InstallPWAButton } from "@/components/install-pwa-button";
import Dashboard from "@/pages/dashboard";
import Journal from "@/pages/journal";
import { MasterTraderPanel } from "@/components/master-trader-panel";
import { MatchesFixerInline } from "@/components/matches-fixer-panel";
import { AnalisisToolSection } from "@/components/analisis-tool-section";
import { ManualTradingSection } from "@/components/manual-trading-section";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "master",    label: "Master Bot", icon: Brain           },
  { id: "analisis",  label: "Analisis",   icon: BarChart2       },
  { id: "trading",   label: "Trading",    icon: Hand            },
  { id: "journal",   label: "Journal",    icon: BookOpen        },
] as const;

type TabId = typeof TABS[number]["id"];

type MasterBotId = "master-trader" | "matches-fixer";

const MASTER_BOTS: { id: MasterBotId; label: string; icon: typeof Brain }[] = [
  { id: "master-trader",  label: "Master Trader",  icon: Brain },
  { id: "matches-fixer",  label: "Matches Fixer",  icon: Zap   },
];

function MasterBotPanel() {
  const [activeBotId, setActiveBotId] = useState<MasterBotId>("master-trader");

  return (
    <div className="space-y-4">
      {/* Bot switcher pill row */}
      <div className="flex gap-2 p-1 rounded-xl border border-border bg-muted/20 w-fit">
        {MASTER_BOTS.map((bot) => {
          const Icon = bot.icon;
          const isActive = activeBotId === bot.id;
          return (
            <button
              key={bot.id}
              onClick={() => setActiveBotId(bot.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-mono text-xs font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {bot.label}
            </button>
          );
        })}
      </div>

      {/* Active bot */}
      {activeBotId === "master-trader" && <MasterTraderPanel />}
      {activeBotId === "matches-fixer" && <MatchesFixerInline />}
    </div>
  );
}

export function TabbedApp() {
  const [active, setActive] = useState<number>(0);
  const touchStartX = useRef<number | null>(null);
  const { data: accounts } = useListAccounts();
  const activeAccount = accounts?.find((a: any) => a.isActive) ?? null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) < 50) return;
    if (delta > 0 && active < TABS.length - 1) setActive((a) => a + 1);
    if (delta < 0 && active > 0) setActive((a) => a - 1);
    touchStartX.current = null;
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden selection:bg-primary/30">
      <header className="h-13 border-b border-border bg-background flex items-center justify-between px-4 shrink-0 z-10">
        <h1 className="text-base font-mono font-bold text-primary tracking-tight">
          TRADE<span className="text-foreground">HUB</span>
        </h1>
        <div className="flex items-center gap-2">
          <InstallPWAButton />
          <AccountPill account={activeAccount} />
        </div>
      </header>

      <div className="flex shrink-0 border-b border-border bg-background">
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setActive(i)}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2.5 px-1 font-mono tracking-wider whitespace-nowrap transition-colors flex-1 border-b-2 ${
              active === i
                ? "text-primary border-primary bg-primary/5"
                : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[9px] sm:text-[11px] font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      <div
        className="flex-1 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-in-out"
          style={{
            width: `${TABS.length * 100}%`,
            transform: `translateX(-${active * (100 / TABS.length)}%)`,
          }}
        >
          {TABS.map((tab) => (
            <div
              key={tab.id}
              className="overflow-y-auto h-full"
              style={{ width: `${100 / TABS.length}%` }}
            >
              <div className="mx-auto max-w-7xl p-4 md:p-6 pb-10">
                <PanelContent id={tab.id} activeAccount={activeAccount} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PanelContent({ id, activeAccount }: { id: TabId; activeAccount: any }) {
  switch (id) {
    case "dashboard": return <Dashboard />;
    case "master":    return <MasterBotPanel />;
    case "analisis":  return <AnalisisToolSection />;
    case "trading":   return <ManualTradingSection activeAccount={activeAccount} />;
    case "journal":   return <Journal />;
  }
}

function AccountPill({ account }: { account: any }) {
  if (!account) {
    return (
      <div className="px-2 py-1 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-[9px] font-mono leading-none">
        No account
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/50 border border-border">
      <div
        className={`h-2 w-2 rounded-full shrink-0 ${account.accountType === "real" ? "bg-primary" : "bg-chart-3"}`}
      />
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-mono font-medium leading-none truncate">
          {account.balance.toLocaleString("en-US", { style: "currency", currency: account.currency })}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground leading-none mt-0.5 truncate">
          {account.label}
        </span>
      </div>
    </div>
  );
}
