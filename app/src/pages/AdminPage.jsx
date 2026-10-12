import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, XCircle, Users, RefreshCw, Trash2, ShieldCheck, Bell,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import Avatar from "../components/Avatar";

const TABS = [
  { id: "pending", label: "En attente" },
  { id: "approved", label: "Approuvés" },
  { id: "rejected", label: "Refusés" },
];

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("pending");
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setProfiles(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => profiles.filter((p) => p.status === tab),
    [profiles, tab],
  );

  const updateStatus = async (id, status) => {
    setBusyId(id);
    const { error } = await supabase
      .from("profiles")
      .update({
        status,
        approved_at: status === "approved" ? new Date().toISOString() : null,
        approved_by: status === "approved" ? user.id : null,
      })
      .eq("id", id);
    if (error) setError(error.message);
    else await load();
    setBusyId(null);
  };

  const toggleAdmin = async (p) => {
    if (p.id === user.id) return;
    setBusyId(p.id);
    const { error } = await supabase
      .from("profiles")
      .update({ role: p.role === "admin" ? "user" : "admin" })
      .eq("id", p.id);
    if (error) setError(error.message);
    else await load();
    setBusyId(null);
  };

  const del = async (id) => {
    if (id === user.id || !confirm("Supprimer cet utilisateur ?")) return;
    setBusyId(id);
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id);
    if (error) setError(error.message);
    else await load();
    setBusyId(null);
  };

  const counts = {
    pending: profiles.filter((p) => p.status === "pending").length,
    approved: profiles.filter((p) => p.status === "approved").length,
    rejected: profiles.filter((p) => p.status === "rejected").length,
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#7B0503]" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a8f90]">
              Administration
            </span>
          </div>
          <h1 className="page-header-title">Gestion des utilisateurs</h1>
          <p className="page-header-description">
            Validez, refusez ou gérez les accès à l'application.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#EEEEEE] px-3 py-2 text-sm hover:bg-[#C5C1C1] disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Rafraîchir
        </button>
      </div>

      {counts.pending > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <Bell size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">
              {counts.pending} demande{counts.pending > 1 ? "s" : ""} d'accès en
              attente
            </p>
            <p className="mt-0.5 text-amber-700">
              Validez ou refusez les comptes ci-dessous pour permettre la
              connexion.
            </p>
          </div>
        </div>
      )}

      <div className="mb-5 flex gap-1 border-b border-gray-200">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? "border-b-2 border-[#7B0503] text-[#7B0503]"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {label}
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {counts[id]}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          ⚠ {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <p className="p-6 text-center text-sm text-gray-500">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">
            Aucun utilisateur dans cette catégorie.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#f7f7f6]">
              <tr>
                {["Utilisateur", "Entreprise / Fonction", "Rôle", "Créé le", "Actions"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-2 text-xs font-semibold uppercase text-gray-500 ${
                        i === 4 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar profile={p} size={32} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">@{p.username}</p>
                        <p className="truncate text-xs text-gray-500">
                          {p.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{p.entreprise || "—"}</p>
                    <p className="text-xs text-gray-500">
                      {p.fonction || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {p.role === "admin" ? (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        Admin
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        Utilisateur
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(p.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {p.status !== "approved" && (
                        <button
                          onClick={() => updateStatus(p.id, "approved")}
                          disabled={busyId === p.id}
                          title="Approuver"
                          className="rounded-md bg-green-600 p-1.5 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                      {p.status !== "rejected" && (
                        <button
                          onClick={() => updateStatus(p.id, "rejected")}
                          disabled={busyId === p.id}
                          title="Refuser"
                          className="rounded-md bg-amber-500 p-1.5 text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                      {p.status === "approved" && p.id !== user.id && (
                        <button
                          onClick={() => toggleAdmin(p)}
                          disabled={busyId === p.id}
                          title={
                            p.role === "admin" ? "Retirer admin" : "Promouvoir admin"
                          }
                          className="rounded-md bg-purple-600 p-1.5 text-white hover:bg-purple-700 disabled:opacity-50"
                        >
                          <Users size={14} />
                        </button>
                      )}
                      {p.id !== user.id && (
                        <button
                          onClick={() => del(p.id)}
                          disabled={busyId === p.id}
                          title="Supprimer"
                          className="rounded-md bg-red-600 p-1.5 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}