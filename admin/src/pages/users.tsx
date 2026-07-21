import { useUsers, useToggleUserSuspension, useToggleUserRestriction } from '@/hooks/use-queries';
import { Loader2, Search, ShieldAlert, ShieldX, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { cn } from '@/components/layout';

export default function Users() {
  const { data: users, isLoading } = useUsers();
  const suspend = useToggleUserSuspension();
  const restrict = useToggleUserRestriction();
  const [searchTerm, setSearchTerm] = useState('');

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;
  }

  const filteredUsers = users?.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.active_role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleSuspend = (id: string, currentlySuspended: boolean) => {
    const action = currentlySuspended ? "Unsuspend" : "Suspend";
    if (confirm(`${action} this user? ${currentlySuspended ? "They will regain access." : "They will be blocked from logging in."}`)) {
      suspend.mutate({ id, suspend: !currentlySuspended });
    }
  };

  const handleToggleRestrict = (id: string, currentlyRestricted: boolean) => {
    const action = currentlyRestricted ? "Unrestrict" : "Restrict";
    if (confirm(`${action} this user? ${currentlyRestricted ? "They can resume runner activities." : "They will be prevented from taking new orders."}`)) {
      restrict.mutate({ id, restrict: !currentlyRestricted });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold">User Directory</h1>
          <p className="text-muted-foreground mt-1">Manage accounts, roles, and platform access.</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <input
            type="text"
            placeholder="Search name, ID, role..."
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
                <th className="px-6 py-4 font-mono font-semibold">User</th>
                <th className="px-6 py-4 font-mono font-semibold">Role / Level</th>
                <th className="px-6 py-4 font-mono font-semibold">Reputation</th>
                <th className="px-6 py-4 font-mono font-semibold">Status</th>
                <th className="px-6 py-4 font-mono font-semibold text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {filteredUsers?.map((u) => (
                <tr key={u.id} className={cn(
                  "hover:bg-muted/30 transition-colors",
                  u.suspended && "bg-destructive/5 hover:bg-destructive/10"
                )}>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      {u.full_name}
                      {u.role === 'admin' && <span className="bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0.5 rounded font-mono">ADMIN</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-mono">{u.id.substring(0, 12)}...</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Joined {format(new Date(u.created_at), 'MMM yyyy')}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="capitalize font-medium">{u.active_role}</div>
                    <div className="text-xs text-muted-foreground mt-1">{u.run_score_level || 'New'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-mono text-primary font-semibold">{u.run_score} RS</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {u.rating_count > 0 ? (u.rating_sum / u.rating_count).toFixed(1) : 'No ratings'} ★
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      {u.suspended ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                          <ShieldX className="h-3.5 w-3.5" /> Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <UserCheck className="h-3.5 w-3.5" /> Active
                        </span>
                      )}
                      
                      {u.restricted && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600">
                          <ShieldAlert className="h-3.5 w-3.5" /> Restricted (No Orders)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {u.role !== 'admin' && (
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => handleToggleSuspend(u.id, u.suspended)}
                          disabled={suspend.isPending}
                          className={cn(
                            "text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors w-24 text-center",
                            u.suspended 
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" 
                              : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                          )}
                        >
                          {u.suspended ? "Unsuspend" : "Suspend"}
                        </button>
                        
                        <button
                          onClick={() => handleToggleRestrict(u.id, u.restricted)}
                          disabled={restrict.isPending}
                          className={cn(
                            "text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors w-24 text-center",
                            u.restricted 
                              ? "bg-muted text-foreground hover:bg-input" 
                              : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                          )}
                        >
                          {u.restricted ? "Unrestrict" : "Restrict"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredUsers?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    No users found matching your search.
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
