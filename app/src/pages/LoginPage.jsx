import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Loader2, AlertCircle, Mail, Lock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import logomL from "../assets/logomL.png";


export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isApproved, loading, signIn } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated && isApproved) {
      navigate(location.state?.from || "/", { replace: true });
    } else if (isAuthenticated && !isApproved) {
      navigate("/pending", { replace: true });
    }
  }, [loading, isAuthenticated, isApproved, navigate, location.state]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.email.trim() || !form.password) {
      return setError("Email et mot de passe requis.");
    }
    setBusy(true);
    try {
      await signIn(form.email.trim(), form.password);
      // La redirection est gérée par le useEffect ci-dessus
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (/invalid login credentials/i.test(msg)) {
        setError("Email ou mot de passe incorrect.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2.5 text-sm focus:border-[#7B0503] focus:outline-none";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex items-center justify-center rounded-2xl ">
            <img
                        src={logomL}
                        alt="M Logo"
                        className="h-auto w-[145px] object-contain"
                      />
          </div>
          <h1 className="text-xl font-semibold">Cabinet ML experts</h1>
          <p className="mt-1 text-sm text-gray-500">Connectez-vous à votre compte</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              placeholder="Adresse email"
              className={inputCls}
              value={form.email}
              onChange={set("email")}
              autoComplete="email"
              disabled={busy}
            />
          </div>

          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              placeholder="Mot de passe"
              className={inputCls}
              value={form.password}
              onChange={set("password")}
              autoComplete="current-password"
              disabled={busy}
            />
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />{error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#7B0503] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#b80704] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <><Loader2 size={16} className="animate-spin" />Connexion…</> : "Se connecter"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Pas encore de compte ?{" "}
          <Link to="/signup" className="font-medium text-[#7B0503] hover:underline">
            Créer un compte
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-gray-500">
          Après inscription, votre compte devra être validé par un administrateur.
        </p>
      </div>
    </div>
  );
}