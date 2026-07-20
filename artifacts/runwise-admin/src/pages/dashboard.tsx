import { Link } from 'wouter';
import { useDashboardStats } from '@/hooks/use-queries';
import { 
  UserCheck, 
  CarFront, 
  Scale, 
  PackageSearch, 
  Users, 
  DollarSign,
  Loader2,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '@/components/layout';

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading || !stats) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
      </div>
    );
  }

  const cards = [
    {
      title: 'Pending KYC',
      value: stats.pendingVerifications,
      icon: UserCheck,
      href: '/verifications',
      color: 'text-orange-600',
      bg: 'bg-orange-100',
      urgent: stats.pendingVerifications > 0
    },
    {
      title: 'Vehicle Approvals',
      value: stats.pendingVehicles,
      icon: CarFront,
      href: '/vehicles',
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      urgent: stats.pendingVehicles > 0
    },
    {
      title: 'Open Disputes',
      value: stats.openDisputes,
      icon: Scale,
      href: '/disputes',
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      urgent: stats.openDisputes > 0
    },
    {
      title: 'Active Escrow Orders',
      value: stats.activeOrders,
      icon: PackageSearch,
      href: '/orders',
      color: 'text-primary',
      bg: 'bg-primary/10',
      urgent: false
    },
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      href: '/users',
      color: 'text-slate-600',
      bg: 'bg-slate-100',
      urgent: false
    },
    {
      title: 'Platform Revenue',
      value: `$${stats.platformRevenue.toFixed(2)}`,
      icon: DollarSign,
      href: '/wallets',
      color: 'text-secondary-foreground',
      bg: 'bg-secondary',
      urgent: false
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-mono font-bold text-foreground">Operational Overview</h1>
        <p className="text-muted-foreground mt-1">Live metrics from the RunWise network.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Link key={i} href={card.href} className="block group">
              <div className={cn(
                "relative overflow-hidden rounded-xl bg-card border border-card-border p-6 shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-primary/30",
                card.urgent && "border-l-4 border-l-destructive"
              )}>
                <div className="flex items-center justify-between">
                  <div className={cn("p-3 rounded-lg", card.bg)}>
                    <Icon className={cn("h-6 w-6", card.color)} />
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-0 -translate-y-1 translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0" />
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-muted-foreground">{card.title}</h3>
                  <p className="text-3xl font-mono font-bold mt-1 text-card-foreground">
                    {card.value}
                  </p>
                </div>
                {card.urgent && (
                  <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-destructive m-4 animate-pulse"></div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
      
      {/* Decorative dashboard background element */}
      <div className="rounded-xl bg-sidebar p-8 shadow-inner overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.03]" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}>
        </div>
        <div className="relative z-10">
          <h3 className="text-sidebar-foreground font-mono font-bold text-lg mb-2">System Status</h3>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-secondary"></span>
            </span>
            <span className="text-sidebar-foreground/80 text-sm">All services operational</span>
          </div>
        </div>
      </div>
    </div>
  );
}
