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

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return setProfile(null);
    setProfile(await fetchProfile(uid));
  }, [session, fetchProfile]);

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

      // Affiche le loader seulement si on change d'utilisateur
      if (loadedUserId.current !== uid) setLoading(true);

      const p = await fetchProfile(uid);
      if (!mounted) return;
      loadedUserId.current = uid;
      setProfile(p);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => load(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Simple renouvellement du token : pas besoin de recharger le profil
      if (event === "TOKEN_REFRESHED") {
        if (mounted) setSession(s);
        return;
      }
      // setTimeout : évite d'appeler Supabase dans le callback (deadlock)
      setTimeout(() => load(s), 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  /** Inscription email/mot de passe + données métier. */
  const signUp = async ({ email, password, username, entreprise, fonction }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, entreprise, fonction },
      },
    });
    if (error) throw error;
    return data;
  };

  /** Connexion email/mot de passe. */
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
        isAdmin: profile?.role === "admin" && profile?.status === "approved",
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