import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut, RefreshCw, XCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function PendingPage() {
  const navigate = useNavigate();
  const { profile, isApproved, signOut, refreshProfile, loading } = useAuth();

  useEffect(() => {
    if (!loading && isApproved) navigate("/", { replace: true });
  }, [loading, isApproved, navigate]);

  const rejected = profile?.status === "rejected";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${rejected ? "bg-red-50" : "bg-amber-50"}`}>
          {rejected
            ? <XCircle size={28} className="text-red-600" />
            : <Clock size={28} className="text-amber-600" />}
        </div>
        <h1 className="text-xl font-semibold">
          {rejected ? "Compte refusé" : "En attente de validation"}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {rejected
            ? "Votre demande d'accès a été refusée. Contactez un administrateur."
            : "Votre compte a bien été créé. Un administrateur doit valider votre accès."}
        </p>

        {profile && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Compte</p>
            <p className="mt-1 font-medium">{profile.email}</p>
            <p className="text-gray-600">@{profile.username}</p>
            <p className="mt-1 text-xs text-gray-500">
              {profile.fonction} · {profile.entreprise}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {!rejected && (
            <button onClick={refreshProfile}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#7B0503] px-4 py-2 text-sm font-medium text-white hover:bg-[#b80704]">
              <RefreshCw size={14} /> Vérifier mon statut
            </button>
          )}
          <button onClick={signOut}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EEEEEE] px-4 py-2 text-sm hover:bg-[#C5C1C1]">
            <LogOut size={14} /> Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}