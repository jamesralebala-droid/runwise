import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './use-auth';
import type { WaitlistSignup } from '@/lib/types';

export function useWaitlistSignups() {
  return useQuery({
    queryKey: ['waitlist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waitlist_signups')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WaitlistSignup[];
    },
    refetchInterval: 60000,
  });
}

export function useUpdateWaitlistStatus() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('waitlist_signups')
        .update({ status })
        .eq('id', id);
      if (error) throw error;

      await supabase.from('admin_audit_log').insert({
        admin_id: profile!.id,
        action: 'update_waitlist_status',
        target_table: 'waitlist_signups',
        target_id: id,
        notes: `Status changed to ${status}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
}

export function useDeleteWaitlistSignup() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('waitlist_signups')
        .delete()
        .eq('id', id);
      if (error) throw error;

      await supabase.from('admin_audit_log').insert({
        admin_id: profile!.id,
        action: 'delete_waitlist_entry',
        target_table: 'waitlist_signups',
        target_id: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });
}
