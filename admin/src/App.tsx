import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/layout';
import { Loader2 } from 'lucide-react';

import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import Verifications from '@/pages/verifications';
import Vehicles from '@/pages/vehicles';
import Disputes from '@/pages/disputes';
import Orders from '@/pages/orders';
import Users from '@/pages/users';
import Wallets from '@/pages/wallets';
import RestrictedItems from '@/pages/restricted-items';
import AuditLog from '@/pages/audit-log';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // If not logged in, force login page regardless of route
  if (!user) {
    return <Login />;
  }

  return (
    <Switch>
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/verifications" component={() => <ProtectedRoute component={Verifications} />} />
      <Route path="/vehicles" component={() => <ProtectedRoute component={Vehicles} />} />
      <Route path="/disputes" component={() => <ProtectedRoute component={Disputes} />} />
      <Route path="/orders" component={() => <ProtectedRoute component={Orders} />} />
      <Route path="/users" component={() => <ProtectedRoute component={Users} />} />
      <Route path="/wallets" component={() => <ProtectedRoute component={Wallets} />} />
      <Route path="/restricted-items" component={() => <ProtectedRoute component={RestrictedItems} />} />
      <Route path="/audit-log" component={() => <ProtectedRoute component={AuditLog} />} />
      <Route component={() => (
        <Layout>
          <NotFound />
        </Layout>
      )} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
