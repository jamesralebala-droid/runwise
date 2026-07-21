import { useAuth } from '@/hooks/use-auth';
import { supabase, friendlyError } from '@/lib/supabase';
import { useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        throw error;
      }
      
      // The Auth context will automatically check for admin role and handle redirect/logout
    } catch (err) {
      toast({
        title: 'Authentication failed',
        description: friendlyError(err, 'Invalid credentials'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full space-y-8 bg-card p-10 rounded-xl border border-card-border shadow-lg">
        <div className="flex flex-col items-center">
          <div className="bg-primary p-4 rounded-full mb-4 shadow-sm">
            <ShieldCheck className="h-10 w-10 text-secondary" />
          </div>
          <h2 className="text-3xl font-mono font-bold text-card-foreground text-center">RunWise Portal</h2>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            Admin access only. Unauthorized access is prohibited.
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow font-mono"
                placeholder="admin@runwise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Password
              </label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow font-mono"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Authenticate'}
          </button>
        </form>
      </div>
      <div className="mt-8 text-center text-xs text-muted-foreground font-mono">
        &copy; {new Date().getFullYear()} RunWise Logistics. All systems monitored.
      </div>
    </div>
  );
}
