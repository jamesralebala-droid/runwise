import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { 
  RunnerVerification, 
  Vehicle, 
  Dispute, 
  OrderRoom, 
  AdminProfile, 
  Wallet, 
  WalletTransaction, 
  RestrictedItem, 
  AuditLog, 
  DashboardStats 
} from '@/lib/types';
import { useAuth } from './use-auth';

// Helper to log actions
export const logAdminAction = async (adminId: string, action: string, targetType: string, targetId: string, notes: string | null = null) => {
  await supabase.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_type,
    target_id,
    notes
  });
};

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const [verifications, vehicles, disputes, orders, users, transactions] = await Promise.all([
        supabase.from('runner_verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('review_status', 'pending'),
        supabase.from('disputes').select('*', { count: 'exact', head: true }).in('status', ['open', 'reviewing']),
        supabase.from('escrow_transactions').select('*', { count: 'exact', head: true }).eq('status', 'held'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('escrow_transactions').select('platform_fee').eq('status', 'released')
      ]);

      const revenue = transactions.data?.reduce((sum, tx) => sum + (Number(tx.platform_fee) || 0), 0) || 0;

      return {
        pendingVerifications: verifications.count || 0,
        pendingVehicles: vehicles.count || 0,
        openDisputes: disputes.count || 0,
        activeOrders: orders.count || 0,
        totalUsers: users.count || 0,
        platformRevenue: revenue,
      };
    },
    refetchInterval: 60000,
  });
}

// Data Queries
export function useVerifications() {
  return useQuery({
    queryKey: ['verifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('runner_verifications')
        .select('*, profiles(full_name, phone)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RunnerVerification[];
    }
  });
}

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*, profiles(full_name)')
        .eq('review_status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Vehicle[];
    }
  });
}

export function useDisputes() {
  return useQuery({
    queryKey: ['disputes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select('*, profiles(full_name)')
        .in('status', ['open', 'reviewing'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Dispute[];
    }
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_rooms')
        .select('*, escrow_transactions(*), runner:profiles!order_rooms_runner_id_fkey(full_name), customer:profiles!order_rooms_customer_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as OrderRoom[];
    }
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AdminProfile[];
    }
  });
}

export function useWallets() {
  return useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*, profiles(full_name)')
        .order('available_balance', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Wallet[];
    }
  });
}

export function useWalletTransactions(walletId: string | null) {
  return useQuery({
    queryKey: ['wallet_transactions', walletId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as WalletTransaction[];
    },
    enabled: !!walletId,
  });
}

export function useRestrictedItems() {
  return useQuery({
    queryKey: ['restricted_items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restricted_items')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as RestrictedItem[];
    }
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: ['audit_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AuditLog[];
    }
  });
}

// Mutations
export function useApproveVerification() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string, userId: string }) => {
      const { error: err1 } = await supabase
        .from('runner_verifications')
        .update({ status: 'approved' })
        .eq('id', id);
      if (err1) throw err1;
      
      const { error: err2 } = await supabase
        .from('profiles')
        .update({ role: 'runner' })
        .eq('id', userId);
      if (err2) throw err2;
      
      await logAdminAction(profile!.id, 'approve_verification', 'runner_verifications', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
}

export function useRejectVerification() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string, reason: string }) => {
      const { error } = await supabase
        .from('runner_verifications')
        .update({ status: 'rejected', rejection_reason: reason })
        .eq('id', id);
      if (error) throw error;
      
      await logAdminAction(profile!.id, 'reject_verification', 'runner_verifications', id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
}

export function useApproveVehicle() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('vehicles')
        .update({ approved: true, review_status: 'approved' })
        .eq('id', id);
      if (error) throw error;
      
      await logAdminAction(profile!.id, 'approve_vehicle', 'vehicles', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
}

export function useRejectVehicle() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string, reason: string }) => {
      const { error } = await supabase
        .from('vehicles')
        .update({ review_status: 'rejected', rejection_reason: reason })
        .eq('id', id);
      if (error) throw error;
      
      await logAdminAction(profile!.id, 'reject_vehicle', 'vehicles', id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
}

export function useResolveDispute() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, notes, resolution }: { id: string, notes: string, resolution: string }) => {
      const { error } = await supabase
        .from('disputes')
        .update({ status: 'resolved', admin_notes: notes, resolution })
        .eq('id', id);
      if (error) throw error;
      
      await logAdminAction(profile!.id, 'resolve_dispute', 'disputes', id, resolution);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });
}

export function useToggleUserSuspension() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, suspend }: { id: string, suspend: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ suspended: suspend })
        .eq('id', id);
      if (error) throw error;
      
      await logAdminAction(profile!.id, suspend ? 'suspend_user' : 'unsuspend_user', 'profiles', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });
}

export function useToggleUserRestriction() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, restrict }: { id: string, restrict: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ restricted: restrict })
        .eq('id', id);
      if (error) throw error;
      
      await logAdminAction(profile!.id, restrict ? 'restrict_user' : 'unrestrict_user', 'profiles', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });
}

export function useAddRestrictedItem() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (item: Omit<RestrictedItem, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('restricted_items')
        .insert([item])
        .select()
        .single();
      if (error) throw error;
      
      await logAdminAction(profile!.id, 'add_restricted_item', 'restricted_items', data.id, item.name);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restricted_items'] });
    }
  });
}

export function useDeleteRestrictedItem() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, name }: { id: string, name: string }) => {
      const { error } = await supabase
        .from('restricted_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
      
      await logAdminAction(profile!.id, 'delete_restricted_item', 'restricted_items', id, name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restricted_items'] });
    }
  });
}
