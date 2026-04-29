import { useListAccounts, useConnectAccount, useUpdateAccount, useDisconnectAccount, getListAccountsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Wallet, Plus, Trash2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

const connectSchema = z.object({
  label: z.string().min(1, "Label is required"),
  apiToken: z.string().min(8, "API token must be at least 8 characters")
});

export default function Accounts() {
  const { data: accounts, isLoading } = useListAccounts();
  const connectAccount = useConnectAccount();
  const updateAccount = useUpdateAccount();
  const disconnectAccount = useDisconnectAccount();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isConnectOpen, setIsConnectOpen] = useState(false);

  const form = useForm<z.infer<typeof connectSchema>>({
    resolver: zodResolver(connectSchema),
    defaultValues: {
      label: "",
      apiToken: "",
    }
  });

  const onSubmit = (data: z.infer<typeof connectSchema>) => {
    connectAccount.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Account connected successfully" });
        setIsConnectOpen(false);
        form.reset();
      },
      onError: (error: any) => {
        toast({ title: "Failed to connect account", description: error.message || "Unknown error", variant: "destructive" });
      }
    });
  };

  const handleSetActive = (id: number) => {
    updateAccount.mutate({ id, data: { isActive: true } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Active account updated" });
      }
    });
  };

  const handleDisconnect = (id: number) => {
    if (!confirm("Are you sure you want to disconnect this account?")) return;
    disconnectAccount.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Account disconnected" });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground flex items-center gap-2">
          <Wallet className="h-8 w-8 text-primary" />
          ACCOUNTS
        </h1>
        
        <Dialog open={isConnectOpen} onOpenChange={setIsConnectOpen}>
          <DialogTrigger asChild>
            <Button className="font-mono gap-2 rounded-none rounded-br-lg rounded-tl-lg shadow-[2px_2px_0px_0px_hsl(var(--primary-border))] border border-primary hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0px_0px_hsl(var(--primary-border))] transition-all">
              <Plus className="h-4 w-4" />
              CONNECT ACCOUNT
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card/95 backdrop-blur-xl rounded-none border-l-4 border-l-primary">
            <DialogHeader>
              <DialogTitle className="font-mono font-bold uppercase tracking-wider">Connect Deriv Account</DialogTitle>
              <DialogDescription className="font-mono text-xs">
                Get your API token from app.deriv.com → Settings → API token. Ensure it has Read and Trade scopes.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Account Label</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Main Real, Demo Tests" className="font-mono rounded-none bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="apiToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">API Token</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" className="font-mono rounded-none bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={connectAccount.isPending} className="w-full font-mono rounded-none mt-4">
                  {connectAccount.isPending ? "CONNECTING..." : "CONNECT"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-48 w-full bg-muted/50 rounded-none border-l-4 border-l-muted" />
            <Skeleton className="h-48 w-full bg-muted/50 rounded-none border-l-4 border-l-muted" />
          </>
        ) : accounts && accounts.length > 0 ? (
          accounts.map((account) => (
            <Card key={account.id} className={`rounded-none border-l-4 relative overflow-hidden transition-all ${account.isActive ? 'border-l-primary bg-primary/5 shadow-[0_0_15px_-3px_hsl(var(--primary)/0.1)] border-t border-r border-b border-primary/20' : 'border-l-muted-foreground/30 bg-card/50 border-t border-r border-b border-border/50'}`}>
              {account.isActive && (
                <div className="absolute top-0 right-0 p-2">
                  <Badge variant="default" className="font-mono text-[10px] rounded-none">ACTIVE</Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-lg flex items-center gap-2">
                  {account.label}
                </CardTitle>
                <CardDescription className="font-mono text-xs flex items-center gap-2">
                  {account.loginid} 
                  <Badge variant="outline" className="font-mono text-[9px] rounded-none h-4 px-1 py-0 border-muted-foreground/30">{account.accountType}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-3xl font-mono font-bold tracking-tight text-foreground">
                  {account.balance.toLocaleString('en-US', { style: 'currency', currency: account.currency })}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono mt-2">
                  <Clock className="h-3 w-3" />
                  Connected {formatDistanceToNow(new Date(account.connectedAt))} ago
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-4 border-t border-border/50 bg-background/30 px-4 py-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`font-mono text-xs rounded-none h-8 ${account.isActive ? 'text-primary/50 cursor-not-allowed' : 'hover:text-primary'}`}
                  onClick={() => handleSetActive(account.id)}
                  disabled={account.isActive || updateAccount.isPending}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  SET ACTIVE
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 font-mono text-xs rounded-none h-8"
                  onClick={() => handleDisconnect(account.id)}
                  disabled={disconnectAccount.isPending || account.isActive} // prevent disconnecting active account usually
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center border border-dashed border-border/50 rounded-none bg-card/30">
            <AlertCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-mono text-lg font-bold text-muted-foreground">No accounts connected</h3>
            <p className="font-mono text-xs text-muted-foreground/70 mt-1 max-w-sm">
              Connect a Deriv account to start using the trading tools and managing bots.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}