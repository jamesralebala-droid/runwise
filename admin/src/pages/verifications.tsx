import { useState } from 'react';
import { useVerifications, useApproveVerification, useRejectVerification } from '@/hooks/use-queries';
import { Loader2, CheckCircle2, XCircle, ExternalLink, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

export default function Verifications() {
  const { data: verifications, isLoading } = useVerifications();
  const approve = useApproveVerification();
  const reject = useRejectVerification();
  
  const [selectedVerif, setSelectedVerif] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;
  }

  const handleApprove = (id: string, userId: string) => {
    if (confirm('Approve this runner verification? They will gain runner privileges immediately.')) {
      approve.mutate({ id, userId });
    }
  };

  const handleRejectClick = (id: string) => {
    setSelectedVerif(id);
    setRejectReason('');
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (selectedVerif && rejectReason) {
      reject.mutate({ id: selectedVerif, reason: rejectReason }, {
        onSuccess: () => {
          setIsRejectDialogOpen(false);
          setSelectedVerif(null);
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-mono font-bold">KYC Queue</h1>
          <p className="text-muted-foreground mt-1">Review and approve runner identity documents.</p>
        </div>
        <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-mono font-medium">
          {verifications?.length || 0} Pending
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-card-border">
              <tr>
                <th className="px-6 py-4 font-mono font-semibold">Runner Name</th>
                <th className="px-6 py-4 font-mono font-semibold">Submitted</th>
                <th className="px-6 py-4 font-mono font-semibold">Next of Kin</th>
                <th className="px-6 py-4 font-mono font-semibold">Documents</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {!verifications?.length ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto text-muted mb-3" />
                    <p>No pending verifications.</p>
                    <p className="text-xs">The queue is clear.</p>
                  </td>
                </tr>
              ) : (
                verifications.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{v.profiles?.full_name || 'Unknown User'}</div>
                      <div className="text-xs text-muted-foreground mt-1">{v.profiles?.phone || 'No phone'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {format(new Date(v.created_at), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4">
                      <div>{v.next_of_kin_name}</div>
                      <div className="text-xs text-muted-foreground">{v.next_of_kin_phone}</div>
                    </td>
                    <td className="px-6 py-4 space-y-2">
                      <a href={v.id_document_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-primary hover:underline text-xs font-medium">
                        <FileText className="h-3 w-3 mr-1" /> ID Document <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                      </a>
                      <a href={v.selfie_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-primary hover:underline text-xs font-medium">
                        <FileText className="h-3 w-3 mr-1" /> Selfie <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                      </a>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRejectClick(v.id)}
                          disabled={reject.isPending}
                          className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
                          title="Reject"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleApprove(v.id, v.user_id)}
                          disabled={approve.isPending}
                          className="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-md transition-colors flex items-center"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Verification</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection. This will be shown to the user so they can correct it.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea
              className="w-full h-32 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="e.g. ID document is blurry, please upload a clearer image."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => setIsRejectDialogOpen(false)}
              className="px-4 py-2 border border-input text-foreground rounded-md hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReject}
              disabled={!rejectReason || reject.isPending}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50"
            >
              {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Rejection'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
