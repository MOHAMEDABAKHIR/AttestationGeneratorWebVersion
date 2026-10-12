import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadedUserId = useRef(null);

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("[Auth] fetchProfile", error);
      return null;
    }
    return data;
  }, []);

  /**
   * Force une lecture fraîche de la session + du profil.
   * Utilisé par la page /pending (bouton « Vérifier mon statut »).
   */
  const refreshProfile = useCallback(async () => {
    const { data: { session: current } } = await supabase.auth.getSession();
    const uid = current?.user?.id ?? null;
    if (!uid) {
      setSession(null);
      setProfile(null);
      return null;
    }
    setSession(current);
    const p = await fetchProfile(uid);
    setProfile(p);
    return p;
  }, [fetchProfile]);

  useEffect(() => {
    let mounted = true;

    const load = async (s) => {
      if (!mounted) return;
      setSession(s);
      const uid = s?.user?.id ?? null;

      if (!uid) {
        loadedUserId.current = null;
        setProfile(null);
        setLoading(false);
        return;
      }

      if (loadedUserId.current !== uid) setLoading(true);

      const p = await fetchProfile(uid);
      if (!mounted) return;
      loadedUserId.current = uid;
      setProfile(p);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => load(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "TOKEN_REFRESHED") {
        if (mounted) setSession(s);
        return;
      }
      // setTimeout : évite les deadlocks dans le callback Supabase
      setTimeout(() => load(s), 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = async ({ email, password, username, entreprise, fonction }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, entreprise, fonction } },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    loadedUserId.current = null;
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        isAuthenticated: !!session,
        isApproved: profile?.status === "approved",
        isAdmin:
          profile?.role === "admin" && profile?.status === "approved",
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};