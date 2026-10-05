// src/components/ClientNotFoundModal.jsx
import { useEffect, useMemo, useState } from "react";
import { X, AlertCircle, UserPlus, Link2 } from "lucide-react";
import {
  loadCabinet,
  upsertClient,
  getSignataire,
} from "../lib/cabinetStore";

const CIVILITES = [
  { value: "", label: "À renseigner" },
  { value: "H", label: "Homme" },
  { value: "F", label: "Femme" },
];

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#7B0503]">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </label>
  );
}

function ReadOnlyField({ label, children }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[#7B0503]">
        {label}
      </div>
      <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
        {children || <span className="text-gray-400">—</span>}
      </div>
    </div>
  );
}

export default function ClientNotFoundModal({
  extracted,
  onClose,
  onAdded,
}) {
  const cabinet = useMemo(() => loadCabinet(), []);

  const [form, setForm] = useState({
    raisonSociale: extracted?.raisonSociale ?? "",
    adresse: extracted?.adresse ?? "",
    representant: "",
    civilite: "",
    qualiteRepresentant: "",
    signataireId: "",
  });
  const [error, setError] = useState("");

  // Sélection auto si un seul signataire
  useEffect(() => {
    if (cabinet.signataires.length === 1 && !form.signataireId) {
      setForm((f) => ({ ...f, signataireId: cabinet.signataires[0].id }));
    }
  }, [cabinet.signataires, form.signataireId]);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.raisonSociale.trim())
      return setError("La raison sociale est obligatoire.");
    if (!form.adresse.trim()) return setError("L'adresse est obligatoire.");
    if (!form.signataireId)
      return setError(
        "Veuillez associer un signataire (ou en créer un dans la Configuration).",
      );

    try {
      const client = upsertClient({
        raisonSociale: form.raisonSociale.trim(),
        adresse: form.adresse.trim(),
        representant: form.representant.trim(),
        civilite: form.civilite,
        qualiteRepresentant: form.qualiteRepresentant.trim(),
        signataireId: form.signataireId,
      });
      const signataire = getSignataire(client.signataireId);
      onAdded({ client, signataire });
    } catch (err) {
      console.error(err);
      setError("Impossible d'enregistrer le client.");
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#7B0503] focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        {/* En-tête */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdf2f1]">
              <UserPlus size={20} className="text-[#7B0503]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Client non trouvé dans la configuration
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Complétez les informations manquantes pour l'ajouter au cabinet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Données extraites du PDF */}
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
            Données extraites de la déclaration
          </p>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-blue-700">Raison sociale</dt>
              <dd className="font-medium text-blue-900">
                {extracted?.raisonSociale || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-blue-700">Adresse</dt>
              <dd className="font-medium text-blue-900">
                {extracted?.adresse || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-blue-700">Montant non payé TTC</dt>
              <dd className="font-medium text-blue-900">
                {extracted?.montantNonPayeTTC != null
                  ? `${extracted.montantNonPayeTTC.toLocaleString("fr-FR")} DH`
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Formulaire */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Raison sociale">
              <input
                className={inputCls}
                value={form.raisonSociale}
                onChange={set("raisonSociale")}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Adresse de la société">
              <input
                className={inputCls}
                value={form.adresse}
                onChange={set("adresse")}
              />
            </Field>
          </div>

          <Field label="Nom du représentant">
            <input
              className={inputCls}
              value={form.representant}
              onChange={set("representant")}
              placeholder="Ex. Ahmed BENANI"
            />
          </Field>

          <Field label="Civilité du représentant">
            <select
              className={inputCls}
              value={form.civilite}
              onChange={set("civilite")}
            >
              {CIVILITES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="sm:col-span-2">
            <Field
              label="Qualité du représentant"
              hint="Ex. Gérant, Directeur, Président…"
            >
              <input
                className={inputCls}
                value={form.qualiteRepresentant}
                onChange={set("qualiteRepresentant")}
              />
            </Field>
          </div>

          {/* Signataire */}
          <div className="sm:col-span-2">
            <Field
              label="Signataire associé"
              hint={
                cabinet.signataires.length === 0
                  ? "Aucun signataire dans la configuration. Allez dans Configuration pour en créer un."
                  : "Le signataire sera utilisé pour générer l'attestation Word."
              }
            >
              <div className="relative">
                <Link2
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <select
                  className={`${inputCls} pl-9`}
                  value={form.signataireId}
                  onChange={set("signataireId")}
                  disabled={cabinet.signataires.length === 0}
                >
                  <option value="">— Choisir un signataire —</option>
                  {cabinet.signataires.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom} — {s.qualite}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          </div>
        </div>

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#EEEEEE] px-4 py-2 text-sm hover:bg-[#C5C1C1]"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="rounded-lg bg-[#7B0503] px-4 py-2 text-sm font-medium text-white hover:bg-[#b80704]"
          >
            Ajouter le client
          </button>
        </div>
      </form>
    </div>
  );
}