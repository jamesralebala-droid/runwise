import { useState } from 'react';
import { useWallets, useWalletTransactions } from '@/hooks/use-queries';
import { Loader2, Wallet as WalletIcon, ArrowDownRight, ArrowUpRight, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/components/layout';

export default function Wallets() {
  const { data: wallets, isLoading } = useWallets();
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-mono font-bold">Wallets & Balances</h1>
          <p className="text-muted-foreground mt-1">Monitor platform liquidity and user funds.</p>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-card-border">
              <tr>
                <th className="px-6 py-4 font-mono font-semibold">Owner</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Available</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Pending</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Frozen</th>
                <th className="px-6 py-4 font-mono font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {wallets?.map((w) => (
                <React.Fragment key={w.id}>
                  <tr 
                    className={cn(
                      "hover:bg-muted/30 transition-colors cursor-pointer",
                      expandedWallet === w.id && "bg-muted/20"
                    )}
                    onClick={() => setExpandedWallet(expandedWallet === w.id ? null : w.id)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-md">
                          <WalletIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{w.profiles?.full_name || 'System Wallet'}</div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{w.owner_type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-foreground">
                      P{Number(w.available_balance).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                      P{Number(w.pending_balance).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-destructive">
                      P{Number(w.frozen_balance).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronDown className={cn(
                        "h-5 w-5 text-muted-foreground inline-block transition-transform duration-200",
                        expandedWallet === w.id && "rotate-180"
                      )} />
                    </td>
                  </tr>
                  {expandedWallet === w.id && (
                    <tr>
                      <td colSpan={5} className="p-0 border-b-0">
                        <TransactionHistory walletId={w.id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TransactionHistory({ walletId }: { walletId: string }) {
  const { data: txs, isLoading } = useWalletTransactions(walletId);

  if (isLoading) {
    return <div className="p-8 flex justify-center bg-muted/10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="bg-muted/10 px-6 py-6 shadow-inner">
      <h4 className="text-sm font-semibold mb-4 text-foreground font-mono">Recent Transactions</h4>
      {!txs?.length ? (
        <p className="text-sm text-muted-foreground">No transactions found.</p>
      ) : (
        <div className="space-y-3">
          {txs.map(tx => (
            <div key={tx.id} className="flex items-center justify-between bg-background p-3 rounded-lg border border-border shadow-sm">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-1.5 rounded-full",
                  tx.amount > 0 ? "bg-emerald-100 text-emerald-600" : "bg-destructive/10 text-destructive"
                )}>
                  {tx.amount > 0 ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </div>
                <div>
                  <div className="font-medium capitalize text-sm">{tx.type.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-muted-foreground font-mono">{format(new Date(tx.created_at), 'MMM d, HH:mm')}</div>
                </div>
              </div>
              <div className={cn(
                "font-mono font-bold",
                tx.amount > 0 ? "text-emerald-600" : "text-foreground"
              )}>
                {tx.amount > 0 ? '+' : ''}{Number(tx.amount).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
