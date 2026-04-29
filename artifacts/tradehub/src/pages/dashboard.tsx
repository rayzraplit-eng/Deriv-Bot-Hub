import { useGetDashboardSummary, useGetEquityCurve, useGetSymbolBreakdown, useListAccounts, useListBots } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format } from "date-fns";
import { Activity, ArrowUpRight, ArrowDownRight, Percent, CheckCircle2, XCircle, TrendingUp, BarChart3, Clock, Wallet, ShieldAlert, Zap, Download, Bot, LineChart as LineChartIcon, Hand, Calculator, BarChart2, Target } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FreeBotsSection } from "@/components/free-bots-section";
import { AnalisisToolSection } from "@/components/analisis-tool-section";
import { ManualTradingSection } from "@/components/manual-trading-section";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: equityCurve, isLoading: isLoadingEquity } = useGetEquityCurve();
  const { data: symbols, isLoading: isLoadingSymbols } = useGetSymbolBreakdown();
  const { data: accounts, isLoading: isLoadingAccounts } = useListAccounts();
  const { data: bots, isLoading: isLoadingBots } = useListBots();

  const activeAccount = accounts?.find(a => a.isActive);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="h-8 w-8 text-primary" />
          OVERVIEW
        </h1>
        {activeAccount && (
          <div className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg shadow-sm">
            <span className="text-muted-foreground text-sm font-mono uppercase">Equity</span>
            <span className="text-xl font-mono font-bold text-primary">
              {activeAccount.balance.toLocaleString('en-US', { style: 'currency', currency: activeAccount.currency })}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Total Profit" 
          value={summary?.totalProfit} 
          icon={TrendingUp} 
          isLoading={isLoadingSummary}
          formatter={(v: number) => (v >= 0 ? '+' : '') + v.toFixed(2)}
          valueClass={summary && summary.totalProfit >= 0 ? "text-primary" : "text-destructive"}
        />
        <StatsCard 
          title="Win Rate" 
          value={summary?.winRate} 
          icon={Percent} 
          isLoading={isLoadingSummary}
          formatter={(v: number) => v.toFixed(1) + '%'}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 border-border shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Equity Curve
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingEquity ? (
              <Skeleton className="h-[300px] w-full bg-muted/50" />
            ) : equityCurve && equityCurve.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equityCurve} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickFormatter={(val) => format(new Date(val), 'MMM dd')}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickFormatter={(val) => `$${val}`}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontFamily: 'monospace' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                      labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Equity']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="equity" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3} 
                      dot={false}
                      activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground font-mono text-sm">
                No equity data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 border-border shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Symbol Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSymbols ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full bg-muted/50" />
                <Skeleton className="h-10 w-full bg-muted/50" />
                <Skeleton className="h-10 w-full bg-muted/50" />
              </div>
            ) : symbols && symbols.length > 0 ? (
              <div className="space-y-4">
                {symbols.slice(0, 5).map((symbol) => (
                  <div key={symbol.symbol} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                    <div>
                      <div className="font-mono font-bold text-sm">{symbol.symbol}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-1">{symbol.trades} trades</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono font-bold text-sm ${symbol.profit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {symbol.profit >= 0 ? '+' : ''}{symbol.profit.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-1">
                        {symbol.winRate.toFixed(1)}% WR
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground font-mono text-sm">
                No symbol data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-mono text-sm tracking-wider text-muted-foreground uppercase flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Recent Bots
            </CardTitle>
            <Link href="/bots" className="text-xs text-primary hover:underline font-mono">View All</Link>
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
                        <Badge variant="outline" className={`font-mono text-[10px] ${
                          bot.status === 'running' ? 'border-primary text-primary bg-primary/10' :
                          bot.status === 'paused' ? 'border-chart-3 text-chart-3 bg-chart-3/10' :
                          'border-muted-foreground text-muted-foreground'
                        }`}>
                          {bot.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground font-mono">
                        {bot.lastRunAt ? format(new Date(bot.lastRunAt), 'MMM dd, HH:mm') : 'Never'}
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
            <Link href="/accounts" className="text-xs text-primary hover:underline font-mono">Manage</Link>
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
                  <div key={account.id} className={`flex items-center justify-between p-3 rounded-lg border ${account.isActive ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border/50'} transition-colors`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${account.isActive ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]' : 'bg-muted-foreground'}`} />
                      <div>
                        <div className="font-mono font-bold text-sm">{account.label}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 h-4 border-muted-foreground/30 text-muted-foreground uppercase">
                            {account.accountType}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">{account.loginid}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-sm">
                      {account.balance.toLocaleString('en-US', { style: 'currency', currency: account.currency })}
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

      <div id="free-bots" className="scroll-mt-6 pt-8">
        <FreeBotsSection />
      </div>

      <div id="analisis-tool" className="scroll-mt-6 pt-8">
        <AnalisisToolSection />
      </div>

      <div id="manual-trading" className="scroll-mt-6 pt-8 pb-12">
        <ManualTradingSection activeAccount={activeAccount ?? null} />
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, isLoading, formatter = (v: any) => v, valueClass = "" }: any) {
  return (
    <Card className="border-border shadow-md bg-card/50 backdrop-blur-sm overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative z-10">
        <CardTitle className="font-mono text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground/50" />
      </CardHeader>
      <CardContent className="relative z-10">
        {isLoading ? (
          <Skeleton className="h-8 w-24 bg-muted/50 mt-1" />
        ) : (
          <div className={`text-2xl font-mono font-bold tracking-tight ${valueClass}`}>
            {value !== undefined && value !== null ? formatter(value) : '-'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}