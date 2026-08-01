import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { 
  Loader2, Mail, Download, Trash2, Search, 
  Users, UserCheck, UserPlus, TrendingUp, MapPin,
  Calendar, Filter, X
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { cn } from '@/components/layout';
import type { WaitlistSignup } from '@/lib/types';

const STATUSES = ['new', 'contacted', 'converted', 'archived'] as const;
const INTEREST_OPTIONS = ['customer', 'runner', 'both'] as const;
const INTEREST_LABELS: Record<string, string> = { customer: 'Customer', runner: 'Runner', both: 'Both' };
const SOURCE_LABELS: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', whatsapp: 'WhatsApp', organic: 'Organic' };

async function fetchWaitlist(): Promise<WaitlistSignup[]> {
  const { data, error } = await supabase
    .from('waitlist_signups')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export default function WaitlistPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [interestFilter, setInterestFilter] = useState('');
  const [townFilter, setTownFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [consentFilter, setConsentFilter] = useState('');
  const [showLocationBreakdown, setShowLocationBreakdown] = useState(true);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});

  const { data: entries, isLoading } = useQuery({
    queryKey: ['waitlist'],
    queryFn: fetchWaitlist,
    refetchInterval: 30000,
  });

  const logAction = useCallback(async (action: string, targetId: string, notes?: string) => {
    if (!profile) return;
    await supabase.from('admin_audit_log').insert({
      admin_id: profile.id,
      action,
      target_table: 'waitlist_signups',
      target_id: targetId,
      notes: notes || null,
    });
  }, [profile]);

  // ── Summary Stats ──
  const stats = useMemo(() => {
    if (!entries) return null;
    const now = new Date();
    const weekAgo = subDays(now, 7);
    return {
      total: entries.length,
      customers: entries.filter(e => e.interest === 'customer').length,
      runners: entries.filter(e => e.interest === 'runner').length,
      both: entries.filter(e => e.interest === 'both').length,
      newThisWeek: entries.filter(e => new Date(e.created_at) >= weekAgo).length,
    };
  }, [entries]);

  // ── Unique towns/cities ──
  const uniqueTowns = useMemo(() => {
    if (!entries) return [];
    const towns = new Set(entries.map(e => e.town_city?.trim()).filter(Boolean));
    return Array.from(towns).sort();
  }, [entries]);

  // ── Location breakdown ──
  const locationBreakdown = useMemo(() => {
    if (!entries) return [];
    const map = new Map<string, { total: number; customers: number; runners: number; both: number }>();
    entries.forEach(e => {
      const town = (e.town_city || 'Unknown').trim();
      if (!map.has(town)) map.set(town, { total: 0, customers: 0, runners: 0, both: 0 });
      const row = map.get(town)!;
      row.total++;
      if (e.interest === 'customer') row.customers++;
      else if (e.interest === 'runner') row.runners++;
      else if (e.interest === 'both') row.both++;
    });
    return Array.from(map.entries())
      .map(([town, counts]) => ({ town, ...counts }))
      .sort((a, b) => b.total - a.total);
  }, [entries]);

  // ── Filtered entries ──
  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries.filter(e => {
      const q = search.toLowerCase();
      const matchesSearch = !q || [
        e.full_name, e.email, e.town_city, e.source, e.interest, e.phone
      ].some(f => (f || '').toLowerCase().includes(q));
      
      const matchesStatus = !statusFilter || e.status === statusFilter;
      const matchesInterest = !interestFilter || e.interest === interestFilter;
      const matchesTown = !townFilter || (e.town_city || '').toLowerCase() === townFilter.toLowerCase();
      
      let matchesConsent = true;
      if (consentFilter === 'yes') matchesConsent = e.marketing_consent === true;
      else if (consentFilter === 'no') matchesConsent = e.marketing_consent === false;
      
      let matchesDate = true;
      if (dateFrom) {
        const from = startOfDay(parseISO(dateFrom));
        matchesDate = matchesDate && new Date(e.created_at) >= from;
      }
      if (dateTo) {
        const to = endOfDay(parseISO(dateTo));
        matchesDate = matchesDate && new Date(e.created_at) <= to;
      }
      
      return matchesSearch && matchesStatus && matchesInterest && matchesTown && matchesConsent && matchesDate;
    });
  }, [entries, search, statusFilter, interestFilter, townFilter, consentFilter, dateFrom, dateTo]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      setSavingStatus(prev => ({ ...prev, [id]: true }));
      const { error } = await supabase.from('waitlist_signups').update({ status }).eq('id', id);
      if (error) throw error;
      await logAction('update_waitlist_status', id, `Status changed to ${status}`);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['waitlist'] }); },
    onSettled: (_data, _error, variables) => {
      setSavingStatus(prev => ({ ...prev, [variables.id]: false }));
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from('waitlist_signups').delete().eq('id', id);
      if (error) throw error;
      await logAction('delete_waitlist_entry', id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['waitlist'] }); },
  });

  const saveNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from('waitlist_signups').update({ notes }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['waitlist'] }); },
  });

  const handleNotesBlur = (id: string) => {
    const notes = editingNotes[id]?.trim() ?? '';
    if (notes !== (entries?.find(e => e.id === id)?.notes ?? '')) {
      saveNotes.mutate({ id, notes });
    }
  };

  // ── CSV Export ──
  const exportCSV = useCallback(() => {
    if (!entries?.length) return;
    const headers = [
      'Name', 'Email', 'Interest', 'Town/City', 'Phone/WhatsApp', 
      'How They Heard', 'Marketing Consent', 'Status', 
      'Frequent Routes', 'Notes', 'Signed Up'
    ];
    const rows = filtered.map(e => [
      e.full_name, e.email, INTEREST_LABELS[e.interest] || e.interest, e.town_city,
      e.phone || '', SOURCE_LABELS[e.source] || e.source,
      e.marketing_consent ? 'Yes' : 'No', e.status,
      e.frequent_routes || '', e.notes || '',
      format(new Date(e.created_at), 'yyyy-MM-dd HH:mm'),
    ]);
    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `runwise-waitlist-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  // ── Clear all filters ──
  const clearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('');
    setInterestFilter('');
    setTownFilter('');
    setDateFrom('');
    setDateTo('');
    setConsentFilter('');
  }, []);

  const hasActiveFilters = search || statusFilter || interestFilter || townFilter || consentFilter || dateFrom || dateTo;
  const activeFilterCount = [search, statusFilter, interestFilter, townFilter, consentFilter, dateFrom, dateTo].filter(Boolean).length;

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold">Waitlist</h1>
          <p className="text-muted-foreground mt-1">Manage early-access signups from the public landing page.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            disabled={!filtered.length}
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-card-border rounded-lg text-sm font-medium text-card-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export {filtered.length} row{filtered.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">Total</span>
              <Users className="h-5 w-5 text-primary opacity-60" />
            </div>
            <div className="text-3xl font-mono font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground mt-1">All signups</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">Customers</span>
              <UserCheck className="h-5 w-5 text-blue-500 opacity-60" />
            </div>
            <div className="text-3xl font-mono font-bold text-foreground">{stats.customers}</div>
            <div className="text-xs text-muted-foreground mt-1">{stats.total ? Math.round(stats.customers / stats.total * 100) : 0}% of signups</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">Runners</span>
              <TrendingUp className="h-5 w-5 text-amber-500 opacity-60" />
            </div>
            <div className="text-3xl font-mono font-bold text-foreground">{stats.runners}</div>
            <div className="text-xs text-muted-foreground mt-1">{stats.total ? Math.round(stats.runners / stats.total * 100) : 0}% of signups</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">Both</span>
              <UserPlus className="h-5 w-5 text-emerald-500 opacity-60" />
            </div>
            <div className="text-3xl font-mono font-bold text-foreground">{stats.both}</div>
            <div className="text-xs text-muted-foreground mt-1">{stats.total ? Math.round(stats.both / stats.total * 100) : 0}% of signups</div>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">New (7d)</span>
              <Calendar className="h-5 w-5 text-violet-500 opacity-60" />
            </div>
            <div className="text-3xl font-mono font-bold text-foreground">{stats.newThisWeek}</div>
            <div className="text-xs text-muted-foreground mt-1">Past 7 days</div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-card border border-card-border rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Filters</span>
            {hasActiveFilters && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">
                {activeFilterCount} active
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Name, email, town, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">All statuses</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Interest/Role */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Role interest</label>
            <select
              value={interestFilter}
              onChange={(e) => setInterestFilter(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">All roles</option>
              {INTEREST_OPTIONS.map(r => (
                <option key={r} value={r}>{INTEREST_LABELS[r]}</option>
              ))}
            </select>
          </div>

          {/* Town/City */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Town / City</label>
            <select
              value={townFilter}
              onChange={(e) => setTownFilter(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">All towns</option>
              {uniqueTowns.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">From date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">To date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Marketing consent */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Marketing consent</label>
            <select
              value={consentFilter}
              onChange={(e) => setConsentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">All</option>
              <option value="yes">Opted in</option>
              <option value="no">Opted out</option>
            </select>
          </div>

          {/* Results count */}
          <div className="flex items-end">
            <div className="w-full px-3 py-2 bg-muted/50 border border-dashed border-card-border rounded-lg text-sm text-muted-foreground">
              <span className="font-semibold">{filtered.length}</span> result{filtered.length !== 1 ? 's' : ''}
              {filtered.length !== (entries?.length || 0) && (
                <span className="text-xs ml-1">of {entries?.length || 0}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Data Table ── */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-card-border">
              <tr>
                <th className="px-5 py-4 font-mono font-semibold whitespace-nowrap">Name</th>
                <th className="px-5 py-4 font-mono font-semibold whitespace-nowrap">Email</th>
                <th className="px-5 py-4 font-mono font-semibold whitespace-nowrap">Phone</th>
                <th className="px-5 py-4 font-mono font-semibold whitespace-nowrap">Interest</th>
                <th className="px-5 py-4 font-mono font-semibold whitespace-nowrap">Town/City</th>
                <th className="px-5 py-4 font-mono font-semibold whitespace-nowrap">Source</th>
                <th className="px-5 py-4 font-mono font-semibold whitespace-nowrap">Consent</th>
                <th className="px-5 py-4 font-mono font-semibold whitespace-nowrap">Status</th>
                <th className="px-5 py-4 font-mono font-semibold whitespace-nowrap">Date</th>
                <th className="px-5 py-4 font-mono font-semibold whitespace-nowrap">Notes</th>
                <th className="px-5 py-4 font-mono font-semibold text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {!filtered.length ? (
                <tr>
                  <td colSpan={11} className="px-5 py-16 text-center text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto text-muted mb-3" />
                    <p className="text-base font-medium">No waitlist signups found</p>
                    <p className="text-xs mt-1 max-w-md mx-auto">
                      {hasActiveFilters 
                        ? 'Try adjusting your filters or clearing search terms.'
                        : 'Share the early-access page to start collecting leads. Signups appear here automatically.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(entry => {
                  const isNotesEditing = entry.id in editingNotes;
                  const currentNotes = isNotesEditing ? editingNotes[entry.id] : (entry.notes || '');
                  return (
                    <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium text-foreground">{entry.full_name || '—'}</div>
                        {entry.frequent_routes && (
                          <div className="text-xs text-muted-foreground mt-0.5 max-w-[180px] truncate" title={entry.frequent_routes}>
                            🚗 {entry.frequent_routes}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <a href={`mailto:${entry.email}`} className="text-primary hover:underline text-sm">{entry.email}</a>
                      </td>
                      <td className="px-5 py-4 text-sm">
                        {entry.phone ? (
                          <span className="font-medium text-foreground">{entry.phone}</span>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider",
                          entry.interest === 'customer' && "bg-blue-100 text-blue-700",
                          entry.interest === 'runner' && "bg-amber-100 text-amber-700",
                          entry.interest === 'both' && "bg-emerald-100 text-emerald-700",
                        )}>
                          {INTEREST_LABELS[entry.interest] || entry.interest}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-foreground">{entry.town_city || '—'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-medium text-muted-foreground">
                          {SOURCE_LABELS[entry.source] || entry.source}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {entry.marketing_consent ? (
                          <span className="text-emerald-600 text-sm" title="Marketing opt-in">✅ Yes</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={entry.status}
                          onChange={(e) => updateStatus.mutate({ id: entry.id, status: e.target.value })}
                          disabled={savingStatus[entry.id]}
                          className={cn(
                            "px-2.5 py-1 text-xs font-semibold rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary",
                            entry.status === 'new' && "bg-blue-100 text-blue-700",
                            entry.status === 'contacted' && "bg-amber-100 text-amber-700",
                            entry.status === 'converted' && "bg-emerald-100 text-emerald-700",
                            entry.status === 'archived' && "bg-slate-100 text-slate-500",
                          )}
                        >
                          {STATUSES.map(s => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-muted-foreground text-xs">
                        {format(new Date(entry.created_at), 'MMM d, yyyy')}
                        <br />
                        {format(new Date(entry.created_at), 'HH:mm')}
                      </td>
                      <td className="px-5 py-4">
                        <input
                          type="text"
                          value={currentNotes}
                          onChange={(e) => setEditingNotes(prev => ({ ...prev, [entry.id]: e.target.value }))}
                          onBlur={() => handleNotesBlur(entry.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleNotesBlur(entry.id); }}
                          placeholder="Internal note..."
                          className="w-full min-w-[100px] px-2 py-1 text-xs bg-transparent border border-transparent hover:border-card-border focus:border-primary rounded-md focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                        />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => {
                            if (window.confirm('Delete this waitlist entry?')) {
                              deleteEntry.mutate({ id: entry.id });
                            }
                          }}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Location Breakdown ── */}
      {locationBreakdown.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div 
            className="flex items-center justify-between px-6 py-4 border-b border-card-border cursor-pointer select-none hover:bg-muted/20 transition-colors"
            onClick={() => setShowLocationBreakdown(!showLocationBreakdown)}
          >
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-base font-mono font-bold text-foreground">Location Breakdown</h3>
              <span className="text-xs text-muted-foreground">({locationBreakdown.length} locations)</span>
            </div>
            <span className="text-xs text-muted-foreground">{showLocationBreakdown ? 'Collapse' : 'Expand'}</span>
          </div>
          {showLocationBreakdown && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-card-border">
                  <tr>
                    <th className="px-6 py-3 font-mono font-semibold">Town / City</th>
                    <th className="px-6 py-3 font-mono font-semibold text-right">Total</th>
                    <th className="px-6 py-3 font-mono font-semibold text-right">Customers</th>
                    <th className="px-6 py-3 font-mono font-semibold text-right">Runners</th>
                    <th className="px-6 py-3 font-mono font-semibold text-right">Both</th>
                    <th className="px-6 py-3 font-mono font-semibold text-right w-48">Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {locationBreakdown.map(loc => {
                    const pct = stats?.total ? Math.round(loc.total / stats.total * 100) : 0;
                    return (
                      <tr key={loc.town} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-3 font-medium text-foreground">{loc.town}</td>
                        <td className="px-6 py-3 text-right font-mono font-semibold">{loc.total}</td>
                        <td className="px-6 py-3 text-right font-mono text-blue-600">{loc.customers}</td>
                        <td className="px-6 py-3 text-right font-mono text-amber-600">{loc.runners}</td>
                        <td className="px-6 py-3 text-right font-mono text-emerald-600">{loc.both}</td>
                        <td className="px-6 py-3">
                          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary/70 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 text-right">{pct}% of total</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
