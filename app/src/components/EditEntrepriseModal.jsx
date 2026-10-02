import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { enrichCompany } from "../lib/companies";

const ANNEES = Array.from({ length: 16 }, (_, i) => 2020 + i);
const TRIMESTRES = ["T1", "T2", "T3", "T4"];
const TYPES = ["Sans retard", "Avec retard"];
const QUALITES = ["Expert-comptable", "Commissaire aux comptes"];
const SIGNATAIRES = ["Mehdi LAHLOU", "Mohamed Ali"];

const toInputDate = (v) => {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#7B0503]">
        {label}
      </span>
      <div className="mt-1">{children}</div>
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

function EditEntrepriseModal({ company, onClose, onSave }) {
  const [form, setForm] = useState({
    pdg: "",
    adresse: "",
    exercice: "",
    trimestre: "",
    type: "",
    montantText: "",
    qualite: "",
    lieu: "",
    signataire: "",
    date: "",
    sexeValue: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!company) return;
    const trimestreRaw = String(company.trimestre ?? "").replace(/\D/g, "");
    setForm({
      pdg: company.pdg ?? "",
      adresse: company.adresse ?? "",
      exercice: String(company.exercice ?? ""),
      trimestre: trimestreRaw ? `T${trimestreRaw}` : "",
      type: company.type ?? "",
      montantText: company.montantText ?? "",
      qualite: company.qualite ?? "",
      lieu: company.lieu ?? "",
      signataire: company.signataire ?? "",
      // Date de signature = toujours aujourd'hui (ignore Excel)
      date: toInputDate(new Date()),
      sexeValue: company.sexeValue ?? "",
    });
    setError("");
  }, [company]);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Calcul temps réel : Période + Template
  const preview = useMemo(() => {
    if (!company) return { periode: null, template: null, avecRetard: false };
    const trimestreNum = form.trimestre.replace(/\D/g, "");
    const draft = {
      ...company,
      pdg: form.pdg,
      adresse: form.adresse,
      exercice: form.exercice,
      trimestre: trimestreNum,
      type: form.type,
      qualite: form.qualite,
      signataire: form.signataire,
      lieu: form.lieu,
    };
    const enriched = enrichCompany(draft, form.sexeValue, form.montantText);
    return {
      periode: enriched.periode,
      template: enriched.template,
      avecRetard: enriched.avecRetard,
    };
  }, [company, form]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.pdg.trim()) return setError("Le nom du PDG est obligatoire.");
    if (!form.adresse.trim()) return setError("L'adresse est obligatoire.");
    if (!form.exercice) return setError("Veuillez choisir un exercice.");
    if (!form.trimestre) return setError("Veuillez choisir un trimestre.");
    if (!form.type) return setError("Veuillez choisir un type d'attestation.");
    if (!form.qualite)
      return setError("Veuillez choisir une qualité de signataire.");
    if (!form.signataire) return setError("Veuillez choisir un signataire.");
    if (!form.date) return setError("Veuillez choisir une date de signature.");

    onSave({
      pdg: form.pdg.trim(),
      adresse: form.adresse.trim(),
      exercice: Number(form.exercice),
      trimestre: form.trimestre.replace(/\D/g, ""), // "T1" -> "1"
      type: form.type,
      montantText: form.montantText,
      qualite: form.qualite,
      lieu: form.lieu.trim(),
      signataire: form.signataire,
      date: form.date,
      sexeValue: form.sexeValue,
    });
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
        className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Modifier l'entreprise</h2>
            <p className="text-xs text-gray-500">
              Ligne Excel n° {company.rowNumber} · {company.raison}
            </p>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* --- Modifiable --- */}

          <Field label="Nom du PDG">
            <input className={inputCls} value={form.pdg} onChange={set("pdg")} />
          </Field>

          <Field label="Civilité du PDG">
            <select
              className={inputCls}
              value={form.sexeValue}
              onChange={set("sexeValue")}
            >
              <option value="">À renseigner</option>
              <option value="H">Homme</option>
              <option value="F">Femme</option>
            </select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Adresse de la société">
              <input
                className={inputCls}
                value={form.adresse}
                onChange={set("adresse")}
              />
            </Field>
          </div>

          <Field label="Exercice">
            <select
              className={inputCls}
              value={form.exercice}
              onChange={set("exercice")}
            >
              <option value="">— Choisir —</option>
              {ANNEES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Trimestre">
            <select
              className={inputCls}
              value={form.trimestre}
              onChange={set("trimestre")}
            >
              <option value="">— Choisir —</option>
              {TRIMESTRES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          {/* --- Lecture seule (calculée) --- */}

          <div className="sm:col-span-2">
            <ReadOnlyField label="Période du trimestre">
              {preview.periode?.libelle ?? (
                <span className="text-red-600">
                  Exercice ou trimestre invalide
                </span>
              )}
            </ReadOnlyField>
          </div>

          {/* --- Modifiable --- */}

          <Field label="Type d'attestation">
            <select
              className={inputCls}
              value={form.type}
              onChange={set("type")}
            >
              <option value="">— Choisir —</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Montant (DH)">
            <input
              type="text"
              inputMode="decimal"
              className={inputCls}
              value={form.montantText}
              onChange={set("montantText")}
              placeholder={
                preview.avecRetard
                  ? "Obligatoire si « Avec retard »"
                  : "Non requis pour « Sans retard »"
              }
            />
          </Field>

          <Field label="Qualité du signataire">
            <select
              className={inputCls}
              value={form.qualite}
              onChange={set("qualite")}
            >
              <option value="">— Choisir —</option>
              {QUALITES.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nom & Prénom du signataire">
            <select
              className={inputCls}
              value={form.signataire}
              onChange={set("signataire")}
            >
              <option value="">— Choisir —</option>
              {SIGNATAIRES.map((sg) => (
                <option key={sg} value={sg}>
                  {sg}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Lieu">
            <input
              className={inputCls}
              value={form.lieu}
              onChange={set("lieu")}
            />
          </Field>

          <Field label="Date de signature">
            <input
              type="date"
              className={inputCls}
              value={form.date}
              onChange={set("date")}
            />
          </Field>

          {/* --- Lecture seule (calculée) --- */}

          <div className="sm:col-span-2">
            <ReadOnlyField label="Template">
              {preview.template ? (
                <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                  {preview.template}
                </code>
              ) : (
                <span className="text-red-600">
                  Introuvable (vérifiez qualité + type)
                </span>
              )}
            </ReadOnlyField>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            ⚠ {error}
          </p>
        )}

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
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditEntrepriseModal;