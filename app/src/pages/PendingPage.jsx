import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, LogOut, RefreshCw, XCircle, Mail, Loader2, CheckCircle2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Avatar from "../components/Avatar";

export default function PendingPage() {
  const navigate = useNavigate();
  const {
    profile,
    isAuthenticated,
    isApproved,
    loading,
    signOut,
    refreshProfile,
  } = useAuth();

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  // Si approuvé → redirige
  useEffect(() => {
    if (!loading && isApproved) navigate("/", { replace: true });
  }, [loading, isApproved, navigate]);

  // Si non authentifié → retour login
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  const handleRefresh = async () => {
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const p = await refreshProfile();
      if (!p) {
        setError("Session expirée. Veuillez vous reconnecter.");
        return;
      }
      if (p.status === "approved") {
        setFeedback("Compte approuvé ! Redirection…");
        // Le useEffect ci-dessus déclenche la navigation
      } else if (p.status === "rejected") {
        setFeedback("Votre compte a été refusé.");
      } else {
        setFeedback("Toujours en attente de validation.");
      }
    } catch (e) {
      setError(e.message || "Impossible de vérifier le statut.");
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(""), 3500);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#7B0503]" />
      </div>
    );
  }

  // Cas rare : pas de session mais on est arrivé ici
  if (!isAuthenticated) return null;

  const rejected = profile?.status === "rejected";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
            rejected ? "bg-red-50" : "bg-amber-50"
          }`}
        >
          {rejected ? (
            <XCircle size={28} className="text-red-600" />
          ) : (
            <Clock size={28} className="text-amber-600" />
          )}
        </div>

        <h1 className="text-xl font-semibold">
          {rejected ? "Compte refusé" : "En attente de validation"}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {rejected
            ? "Votre demande d'accès a été refusée. Contactez un administrateur."
            : "Votre compte a bien été créé. Un administrateur doit valider votre accès."}
        </p>

        {/* Récapitulatif du profil */}
        {profile && (
          <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left">
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
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  rejected
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {rejected ? "Refusé" : "En attente"}
              </span>
              {profile.entreprise && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                  {profile.entreprise}
                </span>
              )}
            </div>
            {profile.fonction && (
              <p className="mt-1.5 text-xs text-gray-500">
                {profile.fonction}
              </p>
            )}
          </div>
        )}

        {/* Feedback */}
        {error && (
          <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            ⚠ {error}
          </p>
        )}
        {feedback && (
          <p className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle2 size={14} />
            {feedback}
          </p>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2">
          {!rejected && (
            <button
              onClick={handleRefresh}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#7B0503] px-4 py-2 text-sm font-medium text-white hover:bg-[#b80704] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Vérification…
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  Vérifier mon statut
                </>
              )}
            </button>
          )}
          <button
            onClick={signOut}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EEEEEE] px-4 py-2 text-sm hover:bg-[#C5C1C1]"
          >
            <LogOut size={14} />
            Se déconnecter
          </button>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1 text-xs text-gray-500">
          <Mail size={12} />
          Contactez votre administrateur si besoin.
        </p>
      </div>
    </div>
  );
}