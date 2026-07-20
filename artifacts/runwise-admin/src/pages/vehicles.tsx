import { useState } from 'react';
import { useVehicles, useApproveVehicle, useRejectVehicle } from '@/hooks/use-queries';
import { Loader2, CheckCircle2, XCircle, ExternalLink, Car } from 'lucide-react';
import { format } from 'date-fns';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

export default function Vehicles() {
  const { data: vehicles, isLoading } = useVehicles();
  const approve = useApproveVehicle();
  const reject = useRejectVehicle();
  
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;
  }

  const handleApprove = (id: string) => {
    if (confirm('Approve this vehicle? It will become active for the runner.')) {
      approve.mutate({ id });
    }
  };

  const handleRejectClick = (id: string) => {
    setSelectedVehicle(id);
    setRejectReason('');
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (selectedVehicle && rejectReason) {
      reject.mutate({ id: selectedVehicle, reason: rejectReason }, {
        onSuccess: () => {
          setIsRejectDialogOpen(false);
          setSelectedVehicle(null);
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-mono font-bold">Vehicle Approvals</h1>
          <p className="text-muted-foreground mt-1">Review and approve runner transportation.</p>
        </div>
        <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-mono font-medium">
          {vehicles?.length || 0} Pending
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-card-border">
              <tr>
                <th className="px-6 py-4 font-mono font-semibold">Runner Name</th>
                <th className="px-6 py-4 font-mono font-semibold">Vehicle Details</th>
                <th className="px-6 py-4 font-mono font-semibold">Submitted</th>
                <th className="px-6 py-4 font-mono font-semibold">Photos</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {!vehicles?.length ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto text-muted mb-3" />
                    <p>No pending vehicle approvals.</p>
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">
                      {v.profiles?.full_name || 'Unknown User'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold">{v.make_model}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-1 border border-border inline-block px-1.5 py-0.5 rounded bg-muted/50">
                        {v.plate_number || 'No plates'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                      {format(new Date(v.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {v.photo_urls?.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block relative w-12 h-12 rounded overflow-hidden border border-border hover:opacity-80 transition-opacity">
                            <img src={url} alt={`Vehicle photo ${idx+1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                              <ExternalLink className="h-4 w-4 text-white" />
                            </div>
                          </a>
                        ))}
                        {(!v.photo_urls || v.photo_urls.length === 0) && (
                          <span className="text-xs text-muted-foreground italic">No photos</span>
                        )}
                      </div>
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
                          onClick={() => handleApprove(v.id)}
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
            <DialogTitle>Reject Vehicle</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea
              className="w-full h-32 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="e.g. License plate not visible in photos."
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
