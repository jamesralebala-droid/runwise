import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearch } from 'wouter';
import { useCreateRefund, usePayments, useRefunds, useUpdateRefund } from '@/hooks/use-queries';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2, Plus, ReceiptText, RotateCcw, XCircle } from 'lucide-react';
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
import type { Refund } from '@/lib/types';

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'PENDING', className: 'bg-amber-100 text-amber-700' },
  processed: { label: 'PROCESSED', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'REJECTED', className: 'bg-destructive/10 text-destructive' },
};

const pct = (n: number | null | undefined) => 'P' + Number(n || 0).toLocaleString('en-BW', { minimumFractionDigits: 2 });

export default function Refunds() {
  const { data: refunds, isLoading } = useRefunds();
  const { data: paidPayments, isLoading: paymentsLoading } = usePayments('paid');
  const create = useCreateRefund();
  const update = useUpdateRefund();
  const { toast } = useToast();

  // Arrive from Payment Verification via /refunds?payment=ID → prefill + open.
  const search = useSearch();
  const presetPayment = useMemo(() => new URLSearchParams(search).get('payment'), [search]);

  const [dialog, setDialog] = useState<'create' | 'process' | 'reject' | null>(null);
  const [active, setActive] = useState<Refund | null>(null);
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const presetOpened = useRef(false);

  useEffect(() => {
    if (!presetPayment || presetOpened.current || paymentsLoading) return;
    const p = (paidPayments || []).find(x => x.id === presetPayment);
    if (!p) return;
    setPaymentId(p.id);
    setAmount(String(p.total_amount));
    setDialog('create');
    presetOpened.current = true;
  }, [presetPayment, paidPayments, paymentsLoading]);

  const pendingCount = useMemo(() => (refunds || []).filter(r => r.status === 'pending').length, [refunds]);
  const processedTotal = useMemo(
    () => (refunds || []).filter(r => r.status === 'processed').reduce((sum, r) => sum + Number(r.amount), 0),
    [refunds]
  );

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;
  }

  const openCreate = () => {
    setPaymentId(presetPayment || '');
    setAmount('');
    setReason('');
    setDialog('create');
  };

  const onPaymentPick = (id: string) => {
    setPaymentId(id);
    const p = (paidPayments || []).find(x => x.id === id);
    setAmount(p ? String(p.total_amount) : '');
  };

  const confirmCreate = () => {
    if (!paymentId) return toast({ title: 'Select a paid payment', variant: 'destructive' });
    if (!reason.trim()) return toast({ title: 'A refund reason is required', variant: 'destructive' });
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast({ title: 'Enter a valid refund amount', variant: 'destructive' });
    const chosen = (paidPayments || []).find(x => x.id === paymentId);
    if (chosen && amt > Number(chosen.total_amount)) {
      return toast({ title: 'Amount exceeds the payment total', variant: 'destructive' });
    }
    create.mutate({ paymentId, amount: amt, reason: reason.trim() }, {
      onSuccess: () => {
        toast({ title: 'Refund created', description: 'Pending review. Processing returns the money and updates the ledger.' });
        setDialog(null);
        setReason('');
        setAmount('');
      },
      onError: (e) => toast({ title: 'Could not create refund', description: (e as Error).message, variant: 'destructive' }),
    });
  };

  const openProcess = (r: Refund) => { setActive(r); setNotes(''); setDialog('process'); };
  const confirmProcess = () => {
    if (!active) return;
    update.mutate({ id: active.id, status: 'processed', notes: notes || undefined }, {
      onSuccess: () => {
        toast({ title: 'Refund processed', description: `P${active.amount} returned to the customer. Ledger updated.` });
        setDialog(null);
      },
      onError: (e) => toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' }),
    });
  };

  const openReject = (r: Refund) => { setActive(r); setReason(''); setDialog('reject'); };
  const confirmReject = () => {
    if (!active || !reason.trim()) return;
    update.mutate({ id: active.id, status: 'rejected', notes: reason.trim() }, {
      onSuccess: () => {
        toast({ title: 'Refund rejected', description: `${active.payment?.order_no || 'Order'} stays PAID.` });
        setDialog(null);
      },
      onError: (e) => toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' }),
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold">Refunds</h1>
          <p className="text-muted-foreground mt-1">
            Process customer refunds against paid payments. Processing returns the money, records a
            REFUND ledger entry and voids the runner earning for that payment.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-mono font-semibold">
            {pendingCount} pending
          </span>
          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-mono font-semibold">
            {pct(processedTotal)} processed
          </span>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-md transition-colors flex items-center"
          >
            <Plus className="h-4 w-4 mr-1.5" /> New Refund
          </button>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-card-border">
              <tr>
                <th className="px-6 py-4 font-mono font-semibold">Order</th>
                <th className="px-6 py-4 font-mono font-semibold">Customer</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Amount</th>
                <th className="px-6 py-4 font-mono font-semibold">Reason</th>
                <th className="px-6 py-4 font-mono font-semibold">Status</th>
                <th className="px-6 py-4 font-mono font-semibold">Requested</th>
                <th className="px-6 py-4 font-mono font-semibold">Processed</th>
                <th className="px-6 py-4 font-mono font-semibold">Notes</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {!refunds?.length ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                    <ReceiptText className="h-10 w-10 mx-auto text-muted mb-3" />
                    <p>No refunds yet. Use “New Refund” or the Refund action on a paid payment.</p>
                  </td>
                </tr>
              ) : (
                refunds.map(r => {
                  const meta = STATUS_META[r.status] || STATUS_META.pending;
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors align-top">
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-primary">{r.payment?.order_no || '—'}</div>
                        <div className="text-xs text-muted-foreground">{r.payment?.reference_number || ''}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{r.customer?.full_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{r.customer?.phone || ''}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold">{pct(r.amount)}</td>
                      <td className="px-6 py-4 text-xs text-muted-foreground max-w-[220px]">{r.reason || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap', meta.className)}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(r.created_at), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-muted-foreground">
                        {r.processed_at ? format(new Date(r.processed_at), 'MMM d, yyyy HH:mm') : '—'}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground max-w-[180px] truncate" title={r.notes || ''}>
                        {r.notes || '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {r.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openReject(r)}
                              disabled={update.isPending}
                              className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
                              title="Reject refund"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openProcess(r)}
                              disabled={update.isPending}
                              className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 font-medium rounded-md transition-colors flex items-center"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Process
                            </button>
                          </div>
                        ) : (
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

      {/* Create refund dialog */}
      <Dialog open={dialog === 'create'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Refund</DialogTitle>
            <DialogDescription>
              Create a pending refund against a paid payment. It stays pending until you process it —
              only processing returns the money and writes the ledger.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Paid payment</label>
              <select
                className="w-full h-9 px-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                value={paymentId}
                onChange={(e) => onPaymentPick(e.target.value)}
              >
                <option value="">Select a paid payment…</option>
                {(paidPayments || []).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.order_no} — {p.customer?.full_name || 'customer'} — {pct(p.total_amount)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Amount (BWP)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="w-full h-9 px-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Reason (required)</label>
              <textarea
                className="w-full h-24 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                placeholder="e.g. Order cancelled before collection, item damaged"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setDialog(null)} className="px-4 py-2 border border-input text-foreground rounded-md hover:bg-muted">Cancel</button>
            <button
              onClick={confirmCreate}
              disabled={create.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center"
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RotateCcw className="h-4 w-4 mr-1.5" />} Create Refund
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process refund dialog */}
      <Dialog open={dialog === 'process'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Confirming returns <b>{active ? pct(active.amount) : ''}</b> to the customer, records a
              REFUND ledger entry, flips the payment to REFUNDED and voids the runner earning for this
              payment. This action is audited.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium text-foreground mb-1">Note (optional)</label>
            <textarea
              className="w-full h-20 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="e.g. Money returned via Orange Money"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <button onClick={() => setDialog(null)} className="px-4 py-2 border border-input text-foreground rounded-md hover:bg-muted">Cancel</button>
            <button
              onClick={confirmProcess}
              disabled={update.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center"
            >
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />} Confirm Refund
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject refund dialog */}
      <Dialog open={dialog === 'reject'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Refund</DialogTitle>
            <DialogDescription>
              The payment stays PAID and no ledger entry is created. A reason is required and recorded in
              the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea
              className="w-full h-24 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-destructive focus:border-transparent resize-none"
              placeholder="e.g. Refund not applicable — order was delivered and completed"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <button onClick={() => setDialog(null)} className="px-4 py-2 border border-input text-foreground rounded-md hover:bg-muted">Cancel</button>
            <button
              onClick={confirmReject}
              disabled={!reason.trim() || update.isPending}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 flex items-center"
            >
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <XCircle className="h-4 w-4 mr-1.5" />} Reject Refund
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
