import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { 
  LayoutDashboard, 
  UserCheck, 
  CarFront, 
  Scale, 
  PackageSearch, 
  Users, 
  Wallet, 
  ShieldAlert, 
  History,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/verifications', label: 'KYC Queue', icon: UserCheck },
  { href: '/vehicles', label: 'Vehicles', icon: CarFront },
  { href: '/disputes', label: 'Disputes', icon: Scale },
  { href: '/orders', label: 'Orders & Escrow', icon: PackageSearch },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/wallets', label: 'Wallets', icon: Wallet },
  { href: '/restricted-items', label: 'Restricted Items', icon: ShieldAlert },
  { href: '/audit-log', label: 'Audit Log', icon: History },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { profile, signOut } = useAuth();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar flex-shrink-0 border-r border-sidebar-border flex flex-col transition-all duration-300">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border bg-sidebar-accent/50">
          <ShieldAlert className="h-6 w-6 text-sidebar-accent-foreground mr-3" />
          <span className="font-mono font-bold text-sidebar-foreground tracking-tight text-lg">
            COMMAND<span className="text-sidebar-accent-foreground">CENTER</span>
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" 
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className={cn(
                    "flex-shrink-0 mr-3 h-5 w-5",
                    isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground/80"
                  )} />
                  {item.label}
                  {isActive && <ChevronRight className="ml-auto h-4 w-4 opacity-50" />}
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/20">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground font-mono font-bold text-xs uppercase shadow-sm">
              {profile?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-sidebar-foreground truncate max-w-[120px]">
                {profile?.full_name || 'Admin'}
              </p>
              <p className="text-xs text-sidebar-foreground/60 font-mono">
                Operator
              </p>
            </div>
            <button
              onClick={() => signOut()}
              className="ml-auto p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary opacity-20 pointer-events-none"></div>
        <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
