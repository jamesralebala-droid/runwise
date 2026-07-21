import { useState } from 'react';
import { useDisputes, useResolveDispute } from '@/hooks/use-queries';
import { Loader2, Scale, ChevronDown, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/components/layout';
import { Dispute } from '@/lib/types';

export default function Disputes() {
  const { data: disputes, isLoading } = useDisputes();
  const resolve = useResolveDispute();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [resolution, setResolution] = useState('');

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;
  }

  const handleExpand = (d: Dispute) => {
    if (expandedId === d.id) {
      setExpandedId(null);
    } else {
      setExpandedId(d.id);
      setNotes(d.admin_notes || '');
      setResolution(d.resolution || '');
    }
  };

  const handleResolve = (id: string) => {
    if (!resolution) {
      alert("Please specify a resolution.");
      return;
    }
    if (confirm("Resolve this dispute? This action is final and may affect escrow funds.")) {
      resolve.mutate({ id, notes, resolution }, {
        onSuccess: () => setExpandedId(null)
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-mono font-bold text-destructive">Dispute Resolution</h1>
          <p className="text-muted-foreground mt-1">Investigate and resolve escalated orders.</p>
        </div>
        <div className="bg-destructive/10 text-destructive px-3 py-1 rounded-full text-sm font-mono font-medium">
          {disputes?.length || 0} Open
        </div>
      </div>

      <div className="space-y-4">
        {!disputes?.length ? (
          <div className="bg-card border border-card-border rounded-xl p-12 text-center text-muted-foreground shadow-sm">
            <Scale className="h-12 w-12 mx-auto text-muted mb-4" />
            <p className="text-lg">No active disputes.</p>
            <p className="text-sm mt-1">All is well in the marketplace.</p>
          </div>
        ) : (
          disputes.map((d) => (
            <div key={d.id} className={cn(
              "bg-card border rounded-xl shadow-sm overflow-hidden transition-all duration-200",
              expandedId === d.id ? "border-destructive/50 ring-1 ring-destructive/20" : "border-card-border hover:border-border/80"
            )}>
              <div 
                className="px-6 py-4 flex items-center justify-between cursor-pointer select-none"
                onClick={() => handleExpand(d)}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-2 rounded-full",
                    d.status === 'open' ? "bg-destructive/10 text-destructive" : "bg-orange-100 text-orange-600"
                  )}>
                    <Scale className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      Order #{d.order_room_id.substring(0, 8).toUpperCase()}
                      <span className="text-xs font-mono font-normal bg-muted px-2 py-0.5 rounded">
                        {d.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Raised by: <span className="font-medium text-foreground">{d.profiles?.full_name || d.raised_by}</span> • {format(new Date(d.created_at), 'MMM d, yyyy')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm font-medium max-w-[200px] truncate text-foreground">
                    {d.reason}
                  </div>
                  <ChevronDown className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform duration-200",
                    expandedId === d.id && "rotate-180"
                  )} />
                </div>
              </div>

              {expandedId === d.id && (
                <div className="px-6 py-5 border-t border-card-border bg-muted/10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold mb-1 text-foreground">Dispute Reason</h4>
                        <p className="text-sm text-muted-foreground bg-background p-3 rounded-md border border-input">
                          {d.reason}
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-semibold mb-1 text-foreground">Evidence Provided</h4>
                        <div className="bg-background p-3 rounded-md border border-input min-h-[100px]">
                          <pre className="text-xs font-mono overflow-auto text-muted-foreground">
                            {JSON.stringify(d.evidence || {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 flex flex-col h-full">
                      <div>
                        <h4 className="text-sm font-semibold mb-1 text-foreground">Admin Investigation Notes</h4>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Log calls, findings, and internal notes here..."
                          className="w-full h-24 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                        />
                      </div>
                      
                      <div className="flex-1 flex flex-col justify-end mt-4">
                        <h4 className="text-sm font-semibold mb-1 text-foreground">Final Resolution</h4>
                        <select
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-4"
                        >
                          <option value="">Select resolution outcome...</option>
                          <option value="refund_customer">Refund Customer (Runner penalized)</option>
                          <option value="release_to_runner">Release to Runner (Customer claim rejected)</option>
                          <option value="split_50_50">Split 50/50</option>
                          <option value="platform_credit">Issue Platform Credit</option>
                        </select>

                        <button
                          onClick={() => handleResolve(d.id)}
                          disabled={resolve.isPending || !resolution}
                          className="w-full py-2.5 bg-destructive text-destructive-foreground font-medium rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center"
                        >
                          {resolve.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-2" /> Close Dispute & Apply Resolution</>}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
