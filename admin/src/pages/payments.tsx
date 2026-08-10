import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  usePayments,
  useVerifyPayment,
  useRejectPayment,
  useRequestPaymentInfo,
  usePaymentMethods,
} from '@/hooks/use-queries';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, MessageSquareWarning, ExternalLink, ShieldCheck, Wallet, RotateCcw } from 'lucide-react';
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
import type { Payment } from '@/lib/types';

const STATUS_META: Record<string, { label: string; className: string }> = {
  payment_verification_required: { label: 'VERIFICATION REQUIRED', className: 'bg-amber-100 text-amber-700' },
  info_requested: { label: 'MORE INFO REQUESTED', className: 'bg-blue-100 text-blue-700' },
  paid: { label: 'PAID', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'REJECTED', className: 'bg-destructive/10 text-destructive' },
  refunded: { label: 'REFUNDED', className: 'bg-violet-100 text-violet-700' },
  cancelled: { label: 'CANCELLED', className: 'bg-muted text-muted-foreground' },
};

const pct = (n: number | null | undefined) => 'P' + Number(n || 0).toLocaleString('en-BW', { minimumFractionDigits: 2 });

export default function Payments() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: payments, isLoading } = usePayments(statusFilter);
  const { data: methods } = usePaymentMethods();
  const verify = useVerifyPayment();
  const reject = useRejectPayment();
  const requestInfo = useRequestPaymentInfo();
  const { toast } = useToast();

  const [active, setActive] = useState<Payment | null>(null);
  const [dialog, setDialog] = useState<'verify' | 'reject' | 'info' | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const methodName = (id: string | null | undefined) =>
    methods?.find(m => m.id === id)?.display_name || id || '—';

  const openDialog = (p: Payment, kind: 'verify' | 'reject' | 'info') => {
    setActive(p);
    setDialog(kind);
    setReason('');
    setNotes('');
  };

  const confirmVerify = () => {
    if (!active) return;
    verify.mutate({ id: active.id, notes: notes || undefined }, {
      onSuccess: () => {
        toast({ title: 'Payment verified', description: `${active.order_no} marked as PAID. Runner earnings recorded.` });
        setDialog(null);
      },
      onError: (e) => toast({ title: 'Verification failed', description: (e as Error).message, variant: 'destructive' }),
    });
  };

  const confirmReject = () => {
    if (!active || !reason.trim()) return;
    reject.mutate({ id: active.id, reason: reason.trim() }, {
      onSuccess: () => {
        toast({ title: 'Payment rejected', description: `${active.order_no} marked as REJECTED.` });
        setDialog(null);
      },
      onError: (e) => toast({ title: 'Rejection failed', description: (e as Error).message, variant: 'destructive' }),
    });
  };

  const confirmInfo = () => {
    if (!active || !reason.trim()) return;
    requestInfo.mutate({ id: active.id, reason: reason.trim() }, {
      onSuccess: () => {
        toast({ title: 'More info requested', description: `${active.order_no} moved to MORE INFO REQUESTED.` });
        setDialog(null);
      },
      onError: (e) => toast({ title: 'Request failed', description: (e as Error).message, variant: 'destructive' }),
    });
  };

  const awaitingCount = useMemo(() => (payments || []).filter(p => p.status === 'payment_verification_required').length, [payments]);

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold">Payment Verification</h1>
          <p className="text-muted-foreground mt-1">
            Verify Orange Money payments before orders proceed. Payment is never auto-approved.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-mono font-medium flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> {awaitingCount} awaiting verification
          </div>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {[
          ['all', 'All'],
          ['payment_verification_required', 'Verification required'],
          ['info_requested', 'More info requested'],
          ['paid', 'Paid'],
          ['rejected', 'Rejected'],
          ['refunded', 'Refunded'],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors border',
              statusFilter === value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-card-border">
              <tr>
                <th className="px-6 py-4 font-mono font-semibold">Order</th>
                <th className="px-6 py-4 font-mono font-semibold">Customer</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Amount Expected</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Reported</th>
                <th className="px-6 py-4 font-mono font-semibold">Method / Recipient</th>
                <th className="px-6 py-4 font-mono font-semibold">Reference</th>
                <th className="px-6 py-4 font-mono font-semibold">Runner</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Commission</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Runner Earns</th>
                <th className="px-6 py-4 font-mono font-semibold">Status</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {!payments?.length ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-muted-foreground">
                    <Wallet className="h-10 w-10 mx-auto text-muted mb-3" />
                    <p>No payments found.</p>
                  </td>
                </tr>
              ) : (
                payments.map(p => {
                  const meta = STATUS_META[p.status] || STATUS_META.cancelled;
                  const canAct = ['payment_verification_required', 'info_requested'].includes(p.status);
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors align-top">
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-primary">{p.order_no}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(p.created_at), 'MMM d, HH:mm')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{p.customer?.full_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{p.customer?.phone || 'No phone'}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold">{pct(p.total_amount)}</td>
                      <td className="px-6 py-4 text-right font-mono">
                        <span className={cn(
                          p.amount_reported != null && Math.abs(p.amount_reported - p.total_amount) > 0.01
                            ? 'text-amber-600 font-semibold'
                            : 'text-foreground'
                        )}>
                          {p.amount_reported != null ? pct(p.amount_reported) : '—'}
                        </span>
                        {p.amount_reported != null && Math.abs(p.amount_reported - p.total_amount) > 0.01 && (
                          <div className="text-[10px] text-amber-600">mismatch</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div>{methodName(p.payment_method)}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Pay to: {p.recipient_name || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs">{p.reference_number || '—'}</div>
                        {p.screenshot_url ? (
                          <a
                            href={p.screenshot_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs flex items-center mt-1"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" /> Screenshot
                          </a>
                        ) : null}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-muted-foreground">{p.runner?.full_name || '—'}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-foreground">{pct(p.commission)}</td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-600">{pct(p.runner_earnings)}</td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap', meta.className)}>
                          {meta.label}
                        </span>
                        {p.info_request_reason && (
                          <div className="text-[11px] text-muted-foreground mt-1 max-w-[160px]" title={p.info_request_reason}>
                            {p.info_request_reason}
                          </div>
                        )}
                        {p.rejection_reason && (
                          <div className="text-[11px] text-destructive mt-1 max-w-[160px]" title={p.rejection_reason}>
                            {p.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {canAct ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openDialog(p, 'info')}
                              disabled={requestInfo.isPending}
                              className="p-2 text-muted-foreground hover:bg-blue-100 hover:text-blue-600 rounded-md transition-colors"
                              title="Request more information"
                            >
                              <MessageSquareWarning className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openDialog(p, 'reject')}
                              disabled={reject.isPending}
                              className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
                              title="Reject payment"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openDialog(p, 'verify')}
                              disabled={verify.isPending}
                              className="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-md transition-colors flex items-center"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Verify
                            </button>
                          </div>
                        ) : p.status === 'paid' ? (
                          <Link
                            href={`/refunds?payment=${p.id}`}
                            className="px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 font-medium rounded-md transition-colors inline-flex items-center"
                          >
                            <RotateCcw className="h-4 w-4 mr-1.5" /> Refund
                          </Link>
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

      {/* Verify dialog */}
      <Dialog open={dialog === 'verify'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Payment — {active?.order_no}</DialogTitle>
            <DialogDescription>
              Confirming this marks the payment as <b>PAID</b>, records the ledger entries
              (customer payment, RunWise commission, runner earnings) and lets the order proceed.
              This action is audited.
            </DialogDescription>
          </DialogHeader>
          {active && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Amount expected</span><b className="font-mono">{pct(active.total_amount)}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount reported</span><b className="font-mono">{active.amount_reported != null ? pct(active.amount_reported) : '—'}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><b className="font-mono">{active.reference_number || '—'}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">RunWise commission</span><b className="font-mono">{pct(active.commission)}</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Runner earnings</span><b className="font-mono text-emerald-600">{pct(active.runner_earnings)}</b></div>
            </div>
          )}
          <div className="py-2">
            <label className="block text-sm font-medium text-foreground mb-1">Internal note (optional)</label>
            <textarea
              className="w-full h-20 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="e.g. Reference matches Orange Money SMS"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <button onClick={() => setDialog(null)} className="px-4 py-2 border border-input text-foreground rounded-md hover:bg-muted">Cancel</button>
            <button
              onClick={confirmVerify}
              disabled={verify.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center"
            >
              {verify.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />} Verify & Mark Paid
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={dialog === 'reject'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Payment — {active?.order_no}</DialogTitle>
            <DialogDescription>
              Rejecting records a payment reversal in the ledger and lets the customer start a new payment.
              A reason is required.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea
              className="w-full h-28 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-destructive focus:border-transparent resize-none"
              placeholder="e.g. Reference number not found on Orange Money, or amount does not match"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <button onClick={() => setDialog(null)} className="px-4 py-2 border border-input text-foreground rounded-md hover:bg-muted">Cancel</button>
            <button
              onClick={confirmReject}
              disabled={!reason.trim() || reject.isPending}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 flex items-center"
            >
              {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <XCircle className="h-4 w-4 mr-1.5" />} Reject Payment
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request info dialog */}
      <Dialog open={dialog === 'info'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request More Information — {active?.order_no}</DialogTitle>
            <DialogDescription>
              Ask the customer for more details. The payment stays open; the customer is prompted to resubmit.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea
              className="w-full h-28 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="e.g. Please upload a screenshot of the Orange Money confirmation SMS"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <button onClick={() => setDialog(null)} className="px-4 py-2 border border-input text-foreground rounded-md hover:bg-muted">Cancel</button>
            <button
              onClick={confirmInfo}
              disabled={!reason.trim() || requestInfo.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {requestInfo.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <MessageSquareWarning className="h-4 w-4 mr-1.5" />} Request More Info
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
