import { useMemo, useState } from 'react';
import { useLedger, usePaymentMethods } from '@/hooks/use-queries';
import { Loader2, BookOpenText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/components/layout';
import type { LedgerTransaction, TransactionType } from '@/lib/types';

const TYPE_META: Record<TransactionType, { label: string; className: string }> = {
  CUSTOMER_PAYMENT: { label: 'Customer Payment', className: 'bg-emerald-100 text-emerald-700' },
  RUNWISE_COMMISSION: { label: 'RunWise Commission', className: 'bg-primary/10 text-primary' },
  RUNNER_EARNING: { label: 'Runner Earnings', className: 'bg-blue-100 text-blue-700' },
  RUNNER_SETTLEMENT: { label: 'Runner Settlement', className: 'bg-violet-100 text-violet-700' },
  REFUND: { label: 'Refund', className: 'bg-amber-100 text-amber-700' },
  PAYMENT_REVERSAL: { label: 'Payment Reversal', className: 'bg-destructive/10 text-destructive' },
  ADJUSTMENT: { label: 'Adjustment', className: 'bg-muted text-muted-foreground' },
};

const ALL_TYPES = Object.keys(TYPE_META) as TransactionType[];

const pct = (n: number | null | undefined) => 'P' + Number(n || 0).toLocaleString('en-BW', { minimumFractionDigits: 2 });

export default function Ledger() {
  const { data: txs, isLoading } = useLedger(500);
  const { data: methods } = usePaymentMethods();

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (txs || []).filter(tx => {
      if (typeFilter !== 'all' && tx.transaction_type !== typeFilter) return false;
      if (methodFilter !== 'all' && tx.payment_method !== methodFilter) return false;
      if (fromDate && new Date(tx.created_at) < new Date(fromDate + 'T00:00:00')) return false;
      if (toDate && new Date(tx.created_at) > new Date(toDate + 'T23:59:59')) return false;
      if (q) {
        const haystack = [
          tx.tx_ref,
          tx.customer?.full_name,
          tx.runner?.full_name,
          tx.reference_number,
          tx.notes,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [txs, typeFilter, methodFilter, fromDate, toDate, search]);

  const totals = useMemo(() => {
    let inflow = 0, outflow = 0;
    filtered.forEach(tx => {
      if (tx.amount >= 0) inflow += tx.amount; else outflow += tx.amount;
    });
    return { inflow, outflow };
  }, [filtered]);

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold">Transaction Ledger</h1>
          <p className="text-muted-foreground mt-1">
            Immutable record of every financial event. Ledger rows can never be edited or deleted.
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-sm">
          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-semibold">+{pct(totals.inflow)}</span>
          <span className="bg-destructive/10 text-destructive px-3 py-1 rounded-full font-semibold">{pct(totals.outflow)}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</label>
          <select
            className="mt-1 w-full h-9 px-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All types</option>
            {ALL_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment method</label>
          <select
            className="mt-1 w-full h-9 px-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
          >
            <option value="all">All methods</option>
            {(methods || []).map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">From</label>
          <input
            type="date"
            className="mt-1 w-full h-9 px-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">To</label>
          <input
            type="date"
            className="mt-1 w-full h-9 px-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search</label>
          <input
            type="search"
            placeholder="Order, customer, runner, ref…"
            className="mt-1 w-full h-9 px-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-card-border">
              <tr>
                <th className="px-6 py-4 font-mono font-semibold">TX Ref</th>
                <th className="px-6 py-4 font-mono font-semibold">Date</th>
                <th className="px-6 py-4 font-mono font-semibold">Type</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Amount</th>
                <th className="px-6 py-4 font-mono font-semibold">Method</th>
                <th className="px-6 py-4 font-mono font-semibold">Customer</th>
                <th className="px-6 py-4 font-mono font-semibold">Runner</th>
                <th className="px-6 py-4 font-mono font-semibold">Reference</th>
                <th className="px-6 py-4 font-mono font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {!filtered.length ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                    <BookOpenText className="h-10 w-10 mx-auto text-muted mb-3" />
                    <p>No ledger entries match these filters.</p>
                  </td>
                </tr>
              ) : (
                filtered.map(tx => {
                  const meta = TYPE_META[tx.transaction_type] || TYPE_META.ADJUSTMENT;
                  const isCredit = tx.amount >= 0;
                  return (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors align-top">
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{tx.tx_ref.slice(0, 14)}…</td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground font-mono text-xs">
                        {format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap', meta.className)}>
                          {meta.label}
                        </span>
                      </td>
                      <td className={cn('px-6 py-4 text-right font-mono font-bold', isCredit ? 'text-emerald-600' : 'text-destructive')}>
                        {isCredit ? '+' : ''}{pct(tx.amount)}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">{tx.payment_method || '—'}</td>
                      <td className="px-6 py-4 text-xs">{tx.customer?.full_name || '—'}</td>
                      <td className="px-6 py-4 text-xs">{tx.runner?.full_name || '—'}</td>
                      <td className="px-6 py-4 font-mono text-xs">{tx.reference_number || '—'}</td>
                      <td className="px-6 py-4 text-xs text-muted-foreground max-w-[220px] truncate" title={tx.notes || ''}>
                        {tx.notes || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
