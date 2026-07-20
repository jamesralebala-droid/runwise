import { Session } from '@supabase/supabase-js';
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Profile, UserRole } from '@/lib/types';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId?: string) => {
    const id = userId || session?.user.id;
    if (!id) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, active_role, run_score, run_score_level, rating_sum, rating_count, suspended, restricted, created_at')
      .eq('id', id)
      .single();
    if (error) throw error;
    setProfile(data as Profile);
  }, [session?.user.id]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) {
        try { await loadProfile(data.session.user.id); } catch { setProfile(null); }
      }
      if (active) setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) loadProfile(nextSession.user.id).catch(() => setProfile(null));
      else setProfile(null);
      setLoading(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const switchRole = useCallback(async (role: UserRole) => {
    if (!profile) return;
    const { error } = await supabase.from('profiles').update({ active_role: role }).eq('id', profile.id);
    if (error) throw error;
    await loadProfile(profile.id);
  }, [loadProfile, profile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(() => ({
    session,
    profile,
    loading,
    refreshProfile: () => loadProfile(),
    switchRole,
    signOut,
  }), [session, profile, loading, loadProfile, switchRole, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
