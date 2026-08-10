import { useMemo, useState } from 'react';
import { useSettlements, useUpdateSettlementStatus, usePaymentMethods, useRunnerWalletSummary } from '@/hooks/use-queries';
import { useToast } from '@/hooks/use-toast';
import { Loader2, HandCoins, CheckCircle2, XCircle, ArrowUpCircle } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/components/layout';
import type { Settlement } from '@/lib/types';

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'PENDING', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'APPROVED', className: 'bg-blue-100 text-blue-700' },
  paid: { label: 'PAID', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'REJECTED', className: 'bg-destructive/10 text-destructive' },
};

const pct = (n: number | null | undefined) => 'P' + Number(n || 0).toLocaleString('en-BW', { minimumFractionDigits: 2 });

export default function Settlements() {
  const { data: settlements, isLoading } = useSettlements();
  const { data: methods } = usePaymentMethods();
  const update = useUpdateSettlementStatus();
  const { toast } = useToast();

  const [active, setActive] = useState<Settlement | null>(null);
  const [dialog, setDialog] = useState<'approve' | 'pay' | 'reject' | null>(null);
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // Runner summary for the active settlement (available balance check)
  const { data: runnerSummary } = useRunnerWalletSummary(active?.runner_id ?? null);

  const pendingCount = useMemo(() => (settlements || []).filter(s => s.status === 'pending').length, [settlements]);
  const paidTotal = useMemo(() => (settlements || []).filter(s => s.status === 'paid').reduce((sum, s) => sum + Number(s.amount), 0), [settlements]);

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;
  }

  const openDialog = (s: Settlement, kind: 'approve' | 'pay' | 'reject') => {
    setActive(s);
    setDialog(kind);
    setMethod(s.payment_method || '');
    setReference('');
    setNotes('');
  };

  const submit = () => {
    if (!active) return;
    if (dialog === 'approve') {
      update.mutate({ id: active.id, status: 'approved', notes: notes || undefined }, {
        onSuccess: () => { toast({ title: 'Settlement approved' }); setDialog(null); },
        onError: (e) => toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' }),
      });
    } else if (dialog === 'pay') {
      if (!method || !reference.trim()) {
        toast({ title: 'Method and reference required to mark as paid', variant: 'destructive' });
        return;
      }
      update.mutate({
        id: active.id,
        status: 'paid',
        paymentMethod: method,
        reference: reference.trim(),
        notes: notes || undefined,
      }, {
        onSuccess: () => { toast({ title: 'Settlement paid', description: `P${active.amount} marked as PAID.` }); setDialog(null); },
        onError: (e) => toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' }),
      });
    } else if (dialog === 'reject') {
      if (!notes.trim()) {
        toast({ title: 'A reason is required to reject', variant: 'destructive' });
        return;
      }
      update.mutate({ id: active.id, status: 'rejected', notes: notes.trim() }, {
        onSuccess: () => { toast({ title: 'Settlement rejected' }); setDialog(null); },
        onError: (e) => toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' }),
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold">Runner Settlements</h1>
          <p className="text-muted-foreground mt-1">
            Approve and pay out runner earnings. Every payout is recorded in the ledger with a reference.
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-sm">
          <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-semibold">{pendingCount} pending</span>
          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-semibold">{pct(paidTotal)} paid out</span>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-card-border">
              <tr>
                <th className="px-6 py-4 font-mono font-semibold">Runner</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Amount</th>
                <th className="px-6 py-4 font-mono font-semibold">Status</th>
                <th className="px-6 py-4 font-mono font-semibold">Method</th>
                <th className="px-6 py-4 font-mono font-semibold">Reference</th>
                <th className="px-6 py-4 font-mono font-semibold">Requested</th>
                <th className="px-6 py-4 font-mono font-semibold">Paid</th>
                <th className="px-6 py-4 font-mono font-semibold">Notes</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {!settlements?.length ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                    <HandCoins className="h-10 w-10 mx-auto text-muted mb-3" />
                    <p>No settlements yet. Runners can request payouts from their earnings.</p>
                  </td>
                </tr>
              ) : (
                settlements.map(s => {
                  const meta = STATUS_META[s.status] || STATUS_META.pending;
                  return (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors align-top">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{s.runner?.full_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{s.runner?.phone || ''}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold">{pct(s.amount)}</td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap', meta.className)}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">{s.payment_method || '—'}</td>
                      <td className="px-6 py-4 font-mono text-xs">{s.reference_number || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(s.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-muted-foreground">
                        {s.paid_at ? format(new Date(s.paid_at), 'MMM d, yyyy HH:mm') : '—'}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground max-w-[180px] truncate" title={s.notes || ''}>
                        {s.notes || '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {s.status === 'pending' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openDialog(s, 'reject')}
                              disabled={update.isPending}
                              className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openDialog(s, 'approve')}
                              disabled={update.isPending}
                              className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 font-medium rounded-md transition-colors flex items-center"
                            >
                              <ArrowUpCircle className="h-4 w-4 mr-1.5" /> Approve
                            </button>
                          </div>
                        )}
                        {s.status === 'approved' && (
                          <button
                            onClick={() => openDialog(s, 'pay')}
                            disabled={update.isPending}
                            className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 font-medium rounded-md transition-colors flex items-center ml-auto"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Mark Paid
                          </button>
                        )}
                        {(s.status === 'paid' || s.status === 'rejected') && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approve dialog */}
      <Dialog open={dialog === 'approve'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Settlement</DialogTitle>
            <DialogDescription>
              Approving confirms the amount is owed and moves it to the payout queue.
              {runnerSummary ? (
                <span className="block mt-2 text-sm font-mono">
                  Runner available earnings: <b>{pct(runnerSummary.available)}</b> · Total earned: {pct(runnerSummary.total_earned)}
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium text-foreground mb-1">Note (optional)</label>
            <textarea
              className="w-full h-20 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="Internal note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <button onClick={() => setDialog(null)} className="px-4 py-2 border border-input text-foreground rounded-md hover:bg-muted">Cancel</button>
            <button
              onClick={submit}
              disabled={update.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ArrowUpCircle className="h-4 w-4 mr-1.5" />} Approve
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark paid dialog */}
      <Dialog open={dialog === 'pay'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Settlement as Paid</DialogTitle>
            <DialogDescription>
              Record how the runner was paid. A RUNNER_SETTLEMENT ledger entry is created with this reference.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Payment method</label>
              <select
                className="w-full h-9 px-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="">Select method…</option>
                {(methods || []).map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Transaction / reference number</label>
              <input
                type="text"
                className="w-full h-9 px-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                placeholder="e.g. OM-2026-48291"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Notes (optional)</label>
              <textarea
                className="w-full h-16 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                placeholder="Payout notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDialog(null)} className="px-4 py-2 border border-input text-foreground rounded-md hover:bg-muted">Cancel</button>
            <button
              onClick={submit}
              disabled={update.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center"
            >
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />} Confirm Paid
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={dialog === 'reject'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Settlement</DialogTitle>
            <DialogDescription>A reason is required and will be recorded in the audit log.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea
              className="w-full h-24 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-destructive focus:border-transparent resize-none"
              placeholder="e.g. Insufficient available earnings or duplicate request"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <button onClick={() => setDialog(null)} className="px-4 py-2 border border-input text-foreground rounded-md hover:bg-muted">Cancel</button>
            <button
              onClick={submit}
              disabled={!notes.trim() || update.isPending}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 flex items-center"
            >
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <XCircle className="h-4 w-4 mr-1.5" />} Reject
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
