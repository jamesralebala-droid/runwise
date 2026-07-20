import { useState } from 'react';
import { useOrders } from '@/hooks/use-queries';
import { Loader2, Search, ArrowRightLeft, Shield } from 'lucide-react';
import { format } from 'date-fns';

export default function Orders() {
  const { data: orders, isLoading } = useOrders();
  const [searchTerm, setSearchTerm] = useState('');

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;
  }

  const filteredOrders = orders?.filter(o => 
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.runner?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getEscrowStatusColor = (status?: string) => {
    switch (status) {
      case 'held': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'released': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'refunded': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground border-input';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold">Orders & Escrow</h1>
          <p className="text-muted-foreground mt-1">Track active matches and held funds.</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <input
            type="text"
            placeholder="Search ID, runner, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-input rounded-md leading-5 bg-background placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition-shadow"
          />
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-card-border">
              <tr>
                <th className="px-6 py-4 font-mono font-semibold">Order ID</th>
                <th className="px-6 py-4 font-mono font-semibold">Participants</th>
                <th className="px-6 py-4 font-mono font-semibold">Escrow Status</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Financials</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {filteredOrders?.map((o) => (
                <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-mono font-semibold text-foreground">
                      {o.id.substring(0, 8).toUpperCase()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(o.created_at), 'MMM d, yyyy HH:mm')}
                    </div>
                    {o.is_read_only && (
                      <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                        CLOSED
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Customer</span>
                        <span className="font-medium text-foreground">{o.customer?.full_name || 'Unknown'}</span>
                      </div>
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground opacity-50" />
                      <div className="flex flex-col">
                        <span className="text-xs text-primary uppercase tracking-wider mb-0.5 font-semibold">Runner</span>
                        <span className="font-medium text-foreground">{o.runner?.full_name || 'Unknown'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {o.escrow_transactions ? (
                      <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getEscrowStatusColor(o.escrow_transactions.status)}`}>
                        <Shield className="h-3 w-3 mr-1" />
                        {o.escrow_transactions.status.toUpperCase()}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No Escrow</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {o.escrow_transactions ? (
                      <div className="space-y-1">
                        <div className="text-sm font-mono font-bold text-foreground">
                          ${o.escrow_transactions.total.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex flex-col items-end gap-0.5">
                          <span>Item: ${o.escrow_transactions.item_value.toFixed(2)}</span>
                          <span>Fee: ${o.escrow_transactions.runner_fee.toFixed(2)}</span>
                          <span className="text-primary font-medium">Platform: ${o.escrow_transactions.platform_fee.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredOrders?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No orders found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
