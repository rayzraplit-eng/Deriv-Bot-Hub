import { useGetDashboardSummary, useListAccounts, useListBots } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { TrendingUp, Percent, BarChart3, Zap, Wallet } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LiveQuoteWidget } from "@/components/live-quote-widget";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: accounts, isLoading: isLoadingAccounts } = useListAccounts();
  const { data: bots, isLoading: isLoadingBots } = useListBots();

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          title="Total Profit"
          value={summary?.totalProfit}
          icon={TrendingUp}
          isLoading={isLoadingSummary}
          formatter={(v: number) => (v >= 0 ? "+" : "") + v.toFixed(2)}
          valueClass={summary && summary.totalProfit >= 0 ? "text-primary" : "text-destructive"}
        />
        <StatsCard
          title="Win Rate"
          value={summary?.winRate}
          icon={Percent}
          isLoading={isLoadingSummary}
          formatter={(v: number) => v.toFixed(1) + "%"}
        />
        <StatsCard
          title="Total Trades"
          value={summary?.totalTrades}
          icon={BarChart3}
          isLoading={isLoadingSummary}
        />
        <StatsCard
          title="Running Bots"
          value={summary?.runningBots}
          icon={Zap}
          isLoading={isLoadingSummary}
          valueClass="text-chart-3"
        />
      </div>

      <LiveQuoteWidget />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Recent Bots
            </CardTitle>
            <Link href="/bots" className="text-xs text-primary hover:underline font-mono">
              View All
            </Link>
          </CardHeader>
          <CardContent>
            {isLoadingBots ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full bg-muted/50" />
                <Skeleton className="h-12 w-full bg-muted/50" />
              </div>
            ) : bots && bots.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="font-mono text-xs">Bot</TableHead>
                    <TableHead className="font-mono text-xs">Status</TableHead>
                    <TableHead className="text-right font-mono text-xs">Last Run</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bots.slice(0, 4).map((bot) => (
                    <TableRow key={bot.id} className="border-border/50 hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono font-medium">
                        <Link href={`/bots/${bot.id}`} className="hover:text-primary transition-colors">
                          {bot.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`font-mono text-[10px] ${
                            bot.status === "running"
                              ? "border-primary text-primary bg-primary/10"
                              : bot.status === "paused"
                              ? "border-chart-3 text-chart-3 bg-chart-3/10"
                              : "border-muted-foreground text-muted-foreground"
                          }`}
                        >
                          {bot.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground font-mono">
                        {bot.lastRunAt ? format(new Date(bot.lastRunAt), "MMM dd, HH:mm") : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground font-mono text-sm">
                No bots imported yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Accounts
            </CardTitle>
            <Link href="/accounts" className="text-xs text-primary hover:underline font-mono">
              Manage
            </Link>
          </CardHeader>
          <CardContent>
            {isLoadingAccounts ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full bg-muted/50" />
                <Skeleton className="h-14 w-full bg-muted/50" />
              </div>
            ) : accounts && accounts.length > 0 ? (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      account.isActive
                        ? "bg-primary/5 border-primary/30"
                        : "bg-muted/30 border-border/50"
                    } transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          account.isActive
                            ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]"
                            : "bg-muted-foreground"
                        }`}
                      />
                      <div>
                        <div className="font-mono font-bold text-sm">{account.label}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono px-1 py-0 h-4 border-muted-foreground/30 text-muted-foreground uppercase"
                          >
                            {account.accountType}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">{account.loginid}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-sm">
                      {account.balance.toLocaleString("en-US", {
                        style: "currency",
                        currency: account.currency,
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground font-mono text-sm">
                No connected accounts
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon: Icon,
  isLoading,
  formatter = (v: any) => v,
  valueClass = "",
}: any) {
  return (
    <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative z-10 px-4 pt-4">
        <CardTitle className="font-mono text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground/50" />
      </CardHeader>
      <CardContent className="relative z-10 px-4 pb-4">
        {isLoading ? (
          <Skeleton className="h-7 w-20 bg-muted/50 mt-1" />
        ) : (
          <div className={`text-xl font-mono font-bold tracking-tight ${valueClass}`}>
            {value !== undefined && value !== null ? formatter(value) : "-"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
