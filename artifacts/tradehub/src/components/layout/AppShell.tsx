import { Link, useLocation } from "wouter";
import { LayoutDashboard, Wallet, Bot, Wrench, BookOpen, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListAccounts } from "@workspace/api-client-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/bots", label: "Bots", icon: Bot },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/journal", label: "Journal", icon: BookOpen },
];

export function Sidebar({ className = "" }: { className?: string }) {
  const [location] = useLocation();

  return (
    <div className={`flex h-full flex-col bg-sidebar border-r border-sidebar-border text-sidebar-foreground w-64 shrink-0 ${className}`}>
      <div className="p-6">
        <h1 className="text-xl font-mono font-bold text-primary tracking-tight">TRADE<span className="text-foreground">HUB</span></h1>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2 rounded-md font-mono text-sm transition-colors cursor-pointer ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Header() {
  const { data: accounts } = useListAccounts();
  const activeAccount = accounts?.find(a => a.isActive);

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <MobileNav />
      </div>
      <div className="flex items-center gap-4">
        {activeAccount ? (
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-muted/50 border border-border">
            <div className={`h-2 w-2 rounded-full ${activeAccount.accountType === 'real' ? 'bg-primary' : 'bg-chart-3'}`} />
            <div className="flex flex-col">
              <span className="text-xs font-mono font-medium leading-none">
                {activeAccount.balance.toLocaleString('en-US', { style: 'currency', currency: activeAccount.currency })}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground leading-none mt-0.5">
                {activeAccount.label} ({activeAccount.accountType})
              </span>
            </div>
          </div>
        ) : (
          <div className="px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-xs font-mono">
            No active account
          </div>
        )}
      </div>
    </header>
  );
}

function MobileNav() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
      {!isMobile && <Sidebar />}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
