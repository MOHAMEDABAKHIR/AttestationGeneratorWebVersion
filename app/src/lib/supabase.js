import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn("[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes");
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // ⬇️ La session est stockée dans sessionStorage :
    //    - persiste tant que l'onglet est ouvert (même après F5)
    //    - disparaît dès que l'onglet est fermé
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});