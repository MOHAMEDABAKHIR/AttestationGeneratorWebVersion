import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2, AlertCircle, Mail, Lock, User, Building2, Briefcase, CheckCircle2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

function Field({ icon: Icon, ...props }) {
  return (
    <div className="relative">
      <Icon
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        {...props}
        className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2.5 text-sm focus:border-[#7B0503] focus:outline-none"
      />
    </div>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [form, setForm] = useState({
    email: "",
    username: "",
    entreprise: "",
    fonction: "",
    password: "",
    confirm: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    if (!form.email.trim()) return "L'adresse email est obligatoire.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return "Adresse email invalide.";
    if (!form.username.trim()) return "Le nom d'utilisateur est obligatoire.";
    if (form.username.trim().length < 3)
      return "Le nom d'utilisateur doit faire au moins 3 caractères.";
    if (!/^[a-zA-Z0-9._-]+$/.test(form.username.trim()))
      return "Le nom d'utilisateur ne peut contenir que lettres, chiffres, . _ -";
    if (!form.entreprise.trim()) return "Le nom de l'entreprise est obligatoire.";
    if (!form.fonction.trim()) return "La fonction est obligatoire.";
    if (!form.password) return "Le mot de passe est obligatoire.";
    if (form.password.length < 8)
      return "Le mot de passe doit faire au moins 8 caractères.";
    if (form.password !== form.confirm)
      return "Les mots de passe ne correspondent pas.";
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) return setError(v);

    setBusy(true);
    try {
      await signUp({
        email: form.email.trim(),
        password: form.password,
        username: form.username.trim(),
        entreprise: form.entreprise.trim(),
        fonction: form.fonction.trim(),
      });

      setDone(true);
      setTimeout(() => navigate("/pending", { replace: true }), 1500);
    } catch (err) {
      const msg = String(err?.message ?? err);

      if (/already registered|already exists|User already registered/i.test(msg)) {
        setError("Un compte existe déjà avec cet email.");
      } else if (
        err?.code === "23505" ||
        /duplicate key|unique constraint/i.test(msg)
      ) {
        setError("Ce nom d'utilisateur est déjà pris. Choisis-en un autre.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] p-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <h1 className="text-xl font-semibold">Compte créé</h1>
          <p className="mt-2 text-sm text-gray-600">
            Votre demande a bien été enregistrée. Un administrateur doit
            valider votre accès avant que vous puissiez vous connecter.
          </p>
          <button
            onClick={() => navigate("/pending", { replace: true })}
            className="mt-6 rounded-lg bg-[#7B0503] px-4 py-2 text-sm font-medium text-white hover:bg-[#b80704]"
          >
            Continuer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdf2f1]">
            <span className="text-2xl font-bold text-[#7B0503]">m</span>
          </div>
          <h1 className="text-xl font-semibold">Créer un compte</h1>
          <p className="mt-1 text-sm text-gray-500">
            Votre compte sera soumis à validation administrateur.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          <Field
            icon={Mail}
            type="email"
            placeholder="Adresse email"
            value={form.email}
            onChange={set("email")}
            disabled={busy}
            autoComplete="email"
          />
          <Field
            icon={User}
            type="text"
            placeholder="Nom d'utilisateur (ex: m.lahlou)"
            value={form.username}
            onChange={set("username")}
            disabled={busy}
            autoComplete="username"
          />
          <Field
            icon={Building2}
            type="text"
            placeholder="Entreprise"
            value={form.entreprise}
            onChange={set("entreprise")}
            disabled={busy}
            autoComplete="organization"
          />
          <Field
            icon={Briefcase}
            type="text"
            placeholder="Fonction (ex: Expert-comptable)"
            value={form.fonction}
            onChange={set("fonction")}
            disabled={busy}
            autoComplete="organization-title"
          />

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field
              icon={Lock}
              type="password"
              placeholder="Mot de passe"
              value={form.password}
              onChange={set("password")}
              disabled={busy}
              autoComplete="new-password"
            />
            <Field
              icon={Lock}
              type="password"
              placeholder="Confirmer"
              value={form.confirm}
              onChange={set("confirm")}
              disabled={busy}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#7B0503] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#b80704] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Création…
              </>
            ) : (
              "Créer mon compte"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Déjà un compte ?{" "}
          <Link
            to="/login"
            className="font-medium text-[#7B0503] hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}