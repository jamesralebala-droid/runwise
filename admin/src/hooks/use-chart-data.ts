import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Time-series chart data for the admin dashboard
// ---------------------------------------------------------------------------

export type DailyMetric = {
  date: string;
  count: number;
  revenue: number;
  signups: number;
};

export function useDailyMetrics() {
  return useQuery({
    queryKey: ['daily-metrics'],
    queryFn: async (): Promise<DailyMetric[]> => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [ordersRes, revenueRes, usersRes] = await Promise.all([
        supabase
          .from('order_rooms')
          .select('created_at')
          .gte('created_at', thirtyDaysAgo.toISOString()),
        supabase
          .from('escrow_transactions')
          .select('created_at, platform_fee')
          .eq('status', 'released')
          .gte('created_at', thirtyDaysAgo.toISOString()),
        supabase
          .from('profiles')
          .select('created_at')
          .gte('created_at', thirtyDaysAgo.toISOString()),
      ]);

      // Build a map of day -> metrics
      const dayMap = new Map<string, { count: number; revenue: number; signups: number }>();
      for (let i = 30; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dayMap.set(d.toISOString().slice(0, 10), { count: 0, revenue: 0, signups: 0 });
      }

      ordersRes.data?.forEach((row) => {
        const day = row.created_at.slice(0, 10);
        const entry = dayMap.get(day);
        if (entry) entry.count++;
      });

      revenueRes.data?.forEach((row) => {
        const day = row.created_at.slice(0, 10);
        const entry = dayMap.get(day);
        if (entry) entry.revenue += Number(row.platform_fee) || 0;
      });

      usersRes.data?.forEach((row) => {
        const day = row.created_at.slice(0, 10);
        const entry = dayMap.get(day);
        if (entry) entry.signups++;
      });

      return Array.from(dayMap.entries()).map(([date, v]) => ({
        date,
        count: v.count,
        revenue: v.revenue,
        signups: v.signups,
      }));
    },
    refetchInterval: 120000,
  });
}
