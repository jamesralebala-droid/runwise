import { useAuditLogs } from '@/hooks/use-queries';
import { Loader2, History } from 'lucide-react';
import { format } from 'date-fns';

export default function AuditLog() {
  const { data: logs, isLoading } = useAuditLogs();

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;
  }

  const formatAction = (action: string) => {
    return action.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-mono font-bold">Audit Log</h1>
          <p className="text-muted-foreground mt-1">Immutable record of all administrator actions.</p>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-card-border">
              <tr>
                <th className="px-6 py-4 font-mono font-semibold">Timestamp</th>
                <th className="px-6 py-4 font-mono font-semibold">Admin</th>
                <th className="px-6 py-4 font-mono font-semibold">Action</th>
                <th className="px-6 py-4 font-mono font-semibold">Target</th>
                <th className="px-6 py-4 font-mono font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {!logs?.length ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <History className="h-10 w-10 mx-auto text-muted mb-3" />
                    <p>No audit records found.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground font-mono text-xs">
                      {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {log.profiles?.full_name || log.admin_id.substring(0, 8)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary whitespace-nowrap">
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-0.5">{log.target_type}</div>
                      <div className="font-mono text-xs">{log.target_id.substring(0, 12)}...</div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground max-w-xs truncate" title={log.notes || ''}>
                      {log.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
