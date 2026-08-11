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
  DashboardStats, 
  Payment, 
  LedgerTransaction, 
  Settlement, 
  PaymentDashboardStats,
  RunnerWalletSummary,
  RunnerEarning,
  Refund,
} from '@/lib/types';
import { useAuth } from './use-auth';

// Helper to log actions
export const logAdminAction = async (adminId: string, action: string, targetTable: string, targetId: string, notes: string | null = null) => {
  await supabase.from('admin_audit_log').insert({
    admin_id: adminId,
    action: action,
    target_table: targetTable,
    target_id: targetId,
    notes: notes
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
        .select('*, profiles!runner_verifications_user_id_fkey(full_name, phone)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RunnerVerification[];
    },
    refetchInterval: 30000,
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
        .select('*, profiles!disputes_raised_by_fkey(full_name)')
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

// ---------------------------------------------------------------------------
// Wallet & Payment System
// ---------------------------------------------------------------------------

const PAYMENT_SELECT = '*, customer:profiles!payments_customer_id_fkey(full_name, phone), runner:profiles!payments_runner_id_fkey(full_name, phone), payment_references(*)';
const TX_SELECT = '*, customer:profiles!transactions_customer_id_fkey(full_name, phone), runner:profiles!transactions_runner_id_fkey(full_name, phone)';

// ---- Payments (admin payment-verification dashboard) ----
export function usePayments(status?: string | 'all') {
  return useQuery({
    queryKey: ['payments', status],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select(PAYMENT_SELECT)
        .order('created_at', { ascending: false })
        .limit(300);
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Payment[];
    },
    refetchInterval: 15000,
  });
}

// ---- Transaction ledger (immutable) ----
export function useLedger(limit = 400) {
  return useQuery({
    queryKey: ['ledger', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(TX_SELECT)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as LedgerTransaction[];
    },
    refetchInterval: 20000,
  });
}

// ---- Settlements ----
export function useSettlements() {
  return useQuery({
    queryKey: ['settlements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlements')
        .select('*, runner:profiles!settlements_runner_id_fkey(full_name, phone)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Settlement[];
    },
    refetchInterval: 15000,
  });
}

// ---- Refunds ----
export function useRefunds() {
  return useQuery({
    queryKey: ['refunds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('refunds')
        .select('*, payment:payments!refunds_payment_id_fkey(order_no, total_amount, payment_method, reference_number), customer:profiles!refunds_customer_id_fkey(full_name, phone)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Refund[];
    },
    refetchInterval: 15000,
  });
}

export function useCreateRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ paymentId, amount, reason }: { paymentId: string; amount: number; reason: string }) => {
      const { data, error } = await supabase.rpc('admin_create_refund', {
        p_payment_id: paymentId,
        p_amount: amount,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      ['refunds', 'payments', 'payment_dashboard_stats'].forEach(k =>
        queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
}

export function useUpdateRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: 'processed' | 'rejected'; notes?: string }) => {
      const { data, error } = await supabase.rpc('admin_update_refund', {
        p_refund_id: id,
        p_status: status,
        p_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      ['refunds', 'payments', 'ledger', 'payment_dashboard_stats', 'runner_earnings', 'wallets'].forEach(k =>
        queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
}

// ---- Runner earnings ----
export function useRunnerEarnings() {
  return useQuery({
    queryKey: ['runner_earnings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('runner_earnings')
        .select('*, runner:profiles!runner_earnings_runner_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as RunnerEarning[];
    },
    refetchInterval: 20000,
  });
}

// ---- Payment methods (modular provider list) ----
export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment_methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .order('sort_order')
        .order('id');
      if (error) throw error;
      return data as { id: string; display_name: string; mode: string; recipient_name: string | null; is_active: boolean; sort_order: number }[];
    },
  });
}

// ---- Dashboard / stats RPCs ----
export function usePaymentDashboardStats() {
  return useQuery({
    queryKey: ['payment_dashboard_stats'],
    queryFn: async (): Promise<PaymentDashboardStats> => {
      const { data, error } = await supabase.rpc('get_admin_payment_dashboard');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? {}) as PaymentDashboardStats;
    },
    refetchInterval: 20000,
  });
}

export function useRunnerWalletSummary(runnerId: string | null) {
  return useQuery({
    queryKey: ['runner_wallet_summary', runnerId],
    queryFn: async (): Promise<RunnerWalletSummary | null> => {
      if (!runnerId) return null;
      const { data, error } = await supabase.rpc('get_runner_wallet_summary', { p_runner_id: runnerId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as RunnerWalletSummary | null;
    },
    enabled: !!runnerId,
  });
}

// ---- Mutations ----
export function useVerifyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data, error } = await supabase.rpc('admin_verify_payment', {
        p_payment_id: id,
        p_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      ['payments', 'ledger', 'payment_dashboard_stats', 'runner_earnings', 'orders'].forEach(k =>
        queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
}

export function useRejectPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('admin_reject_payment', {
        p_payment_id: id,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      ['payments', 'ledger', 'payment_dashboard_stats'].forEach(k =>
        queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
}

export function useRequestPaymentInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('admin_request_payment_info', {
        p_payment_id: id,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      ['payments', 'payment_dashboard_stats'].forEach(k =>
        queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
}

export function useUpdateSettlementStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      paymentMethod,
      reference,
      notes,
    }: {
      id: string;
      status: 'pending' | 'approved' | 'paid' | 'rejected';
      paymentMethod?: string;
      reference?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('admin_update_settlement', {
        p_settlement_id: id,
        p_status: status,
        p_payment_method: paymentMethod || null,
        p_reference_number: reference || null,
        p_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      ['settlements', 'ledger', 'payment_dashboard_stats', 'runner_earnings'].forEach(k =>
        queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
}
