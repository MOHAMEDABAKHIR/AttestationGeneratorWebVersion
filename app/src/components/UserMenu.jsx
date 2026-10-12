import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  LogOut, ShieldCheck, ChevronDown, User as UserIcon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import Avatar from "./Avatar";

export default function UserMenu() {
  const { profile, signOut, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Compteur de demandes en attente (admin uniquement)
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
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAdmin]);

  if (!profile) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100"
        aria-label="Menu utilisateur"
      >
        <div className="relative">
          <Avatar profile={profile} size={30} />
          {isAdmin && pendingCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
              {pendingCount}
            </span>
          )}
        </div>
        <span className="hidden text-sm font-medium sm:inline">
          @{profile.username}
        </span>
        <ChevronDown size={14} className="text-gray-500" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* En-tête : profil + rôle */}
          <div className="border-b border-gray-100 px-3 py-3">
            <div className="flex items-center gap-3">
              <Avatar profile={profile} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  @{profile.username}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {profile.email}
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {isAdmin ? (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                  Administrateur
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                  Utilisateur
                </span>
              )}
              {profile.entreprise && (
                <span className="truncate rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                  {profile.entreprise}
                </span>
              )}
            </div>
            {profile.fonction && (
              <p className="mt-1 truncate text-xs text-gray-500">
                {profile.fonction}
              </p>
            )}
          </div>

          {/* Lien Admin (visible uniquement pour admins) */}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <ShieldCheck size={14} />
              Administration
              {pendingCount > 0 && (
                <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </Link>
          )}

          {/* Mon profil (optionnel — placeholder) */}
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400">
            <UserIcon size={14} />
            {profile.fonction || "Mon compte"}
          </div>

          {/* Déconnexion */}
          <button
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={14} />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}