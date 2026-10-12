import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { LogOut, ShieldCheck, ChevronDown } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export default function UserMenu() {
  const { profile, signOut, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Compteur de demandes en attente (pour l'admin)
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const load = async () => {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (!cancelled) setPendingCount(count ?? 0);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isAdmin]);

  if (!profile) return null;
  const initials = (profile.username || profile.email || "?")[0].toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100">
        <div className="relative">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7B0503] text-xs font-medium text-white">
            {initials}
          </div>
          {isAdmin && pendingCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
              {pendingCount}
            </span>
          )}
        </div>
        <span className="hidden text-sm font-medium sm:inline">@{profile.username}</span>
        <ChevronDown size={14} className="text-gray-500" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="truncate text-sm font-medium">@{profile.username}</p>
            <p className="truncate text-xs text-gray-500">{profile.email}</p>
            <p className="mt-1 truncate text-xs text-gray-400">
              {profile.fonction} · {profile.entreprise}
            </p>
          </div>
          {isAdmin && (
            <Link to="/admin" onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
              <ShieldCheck size={14} />
              Administration
              {pendingCount > 0 && (
                <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </Link>
          )}
          <button onClick={() => { setOpen(false); signOut(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
            <LogOut size={14} /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}