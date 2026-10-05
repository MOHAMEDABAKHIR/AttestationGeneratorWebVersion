import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { enrichCompany } from "../lib/companies";

const TYPES = ["Sans retard", "Avec retard"];
import { useRef } from "react";
import { Upload, Loader2, FileText, AlertCircle as AlertCircleIcon } from "lucide-react";
import { extractDeclarationWithGemini } from "../lib/geminiClient2";

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
    representant: "",
    qualiteRepresentant: "",
    adresse: "",
    type: "",
    montantText: "",
    qualite: "",
    lieu: "",
    signataire: "",
    date: "",
    sexeValue: "",
  });
  const [error, setError] = useState("");

  // 📄 Drop déclaration PDF
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfStep, setPdfStep] = useState("");
  const [pdfDrag, setPdfDrag] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfInfo, setPdfInfo] = useState(null);
  const [manualMode, setManualMode] = useState(false); // true si l'IA a échoué
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!company) return;
    setForm({
      representant: company.representant ?? "",
      qualiteRepresentant: company.qualiteRepresentant ?? "",
      adresse: company.adresse ?? "",
      type: company.type ?? "",
      montantText: company.montantText ?? "",
      qualite: company.qualite ?? "",
      lieu: company.lieu ?? "",
      signataire: company.signataire ?? "",
      // Date de signature : par défaut aujourd'hui
      date: toInputDate(new Date()),
      sexeValue: company.sexeValue ?? "",
    });
    setError("");
  }, [company]);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Si on change le type et qu'on passe à "Sans retard", on vide le montant
      if (key === "type" && value === "Sans retard") {
        next.montantText = "";
      }
      return next;
    });
  };

  // Recalcul en temps réel de Exercice / Trimestre / Période / Template
  const preview = useMemo(() => {
    if (!company) {
      return {
        exercice: "",
        trimestre: "",
        periode: null,
        template: null,
        avecRetard: false,
        dateError: "",
      };
    }
    const draft = {
      ...company,
      representant: form.representant,
      qualiteRepresentant: form.qualiteRepresentant,
      adresse: form.adresse,
      type: form.type,
      qualite: form.qualite,
      signataire: form.signataire,
      lieu: form.lieu,
    };
    const dateForCalc = form.date ? new Date(form.date) : null;
    const enriched = enrichCompany(
      draft,
      form.sexeValue,
      form.montantText,
      dateForCalc,
    );
    const dateError =
      enriched.errors.find(
        (m) =>
          m.includes("date de signature doit") ||
          m.includes("Date de signature"),
      ) ?? "";
    return {
      exercice: enriched.exercice,
      trimestre: enriched.trimestre,
      periode: enriched.periode,
      template: enriched.template,
      avecRetard: enriched.avecRetard,
      dateError,
    };
  }, [company, form]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.representant.trim())
      return setError("Le nom du représentant est obligatoire.");
    if (!form.qualiteRepresentant.trim())
      return setError("La qualité du représentant est obligatoire.");
    if (!form.adresse.trim()) return setError("L'adresse est obligatoire.");
    if (!form.type) return setError("Veuillez choisir un type d'attestation.");
    if (!form.qualite)
      return setError("Veuillez choisir une qualité de signataire.");
    if (!form.signataire) return setError("Veuillez choisir un signataire.");
    if (!form.date) return setError("Veuillez choisir une date de signature.");
    if (preview.dateError) return setError(preview.dateError);

    onSave({
      representant: form.representant.trim(),
      qualiteRepresentant: form.qualiteRepresentant.trim(),
      adresse: form.adresse.trim(),
      type: form.type,
      // ⚠️ Forcer le montant à vide si type = "Sans retard"
      montantText: preview.avecRetard ? form.montantText : "",
      qualite: form.qualite,
      lieu: form.lieu.trim(),
      signataire: form.signataire,
      date: form.date,
      sexeValue: form.sexeValue,
    });
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#7B0503] focus:outline-none";

  const processPdf = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setPdfError("Veuillez sélectionner un fichier PDF.");
      return;
    }

    setPdfError("");
    setPdfInfo(null);
    setPdfBusy(true);
    setPdfStep("Envoi à Gemini…");

    try {
      const expected = company?.raison?.trim() ?? "";
      const result = await extractDeclarationWithGemini(file, {
        onStep: (s) => setPdfStep(s),
        expectedCompany: expected,
      });

      // Vérification que la déclaration correspond à l'entreprise attendue
      if (result.match === false) {
        throw new Error(
          `La déclaration ne correspond pas à cette entreprise. ` +
          `Attendue : "${expected}". Trouvée : "${result.raisonSociale ?? "—"}".`,
        );
      }

      const montant = result.montantNonPayeTTC ?? 0;
      const type = montant > 0 ? "Avec retard" : "Sans retard";

      setForm((f) => ({
        ...f,
        type,
        montantText: montant > 0 ? String(montant) : "",
      }));
      setManualMode(false); // ← IA a réussi, on n'est plus en manuel

      setPdfInfo({
        fileName: file.name,
        raisonSociale: result.raisonSociale,
        adresse: result.adresse,
        montant,
        type,
        model: result.model,
      });
    } catch (err) {
      console.error(err);
      setPdfError(err.message || "Impossible de lire la déclaration.");
      setManualMode(true); // ← bascule en mode manuel
    } finally {
      setPdfBusy(false);
      setPdfStep("");
    }
  };

  const onPdfDrop = async (e) => {
    e.preventDefault();
    setPdfDrag(false);
    const f = e.dataTransfer.files?.[0];
    await processPdf(f);
  };

  const onPdfChange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    await processPdf(f);
  };

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
          {/* --- Représentant --- */}
          <ReadOnlyField label="Nom du représentant">
            {form.representant || <span className="text-red-600">—</span>}
          </ReadOnlyField>

          <ReadOnlyField label="Qualité du représentant">
            {form.qualiteRepresentant || <span className="text-red-600">—</span>}
          </ReadOnlyField>

          <ReadOnlyField label="Civilité du représentant">
            {form.sexeValue === "F" ? (
              "Femme"
            ) : form.sexeValue === "H" ? (
              "Homme"
            ) : (
              <span className="text-amber-600">
                Non renseignée dans Excel (colonne « Civilité du représentant »)
              </span>
            )}
          </ReadOnlyField>

          <div className="sm:col-span-2">
            <div className="sm:col-span-2">
              <ReadOnlyField label="Adresse de la société">
                {form.adresse || <span className="text-red-600">—</span>}
              </ReadOnlyField>
            </div>
          </div>

          {/* --- Date de signature pilote Exercice/Trimestre/Période --- */}
          <Field label="Date de signature">
            <input
              type="date"
              className={inputCls}
              value={form.date}
              onChange={set("date")}
            />
          </Field>

          <ReadOnlyField label="Exercice">
            {preview.exercice || (
              <span className="text-red-600">—</span>
            )}
          </ReadOnlyField>

          <ReadOnlyField label="Trimestre">
            {preview.trimestre ? (
              `T${preview.trimestre}`
            ) : (
              <span className="text-red-600">—</span>
            )}
          </ReadOnlyField>

          <div className="sm:col-span-2">
            <ReadOnlyField label="Période du trimestre">
              {preview.periode?.libelle ?? (
                <span className="text-red-600">
                  {preview.dateError || "En attente d'une date valide"}
                </span>
              )}
            </ReadOnlyField>
          </div>

          {preview.dateError && (
            <div className="sm:col-span-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              ⚠ {preview.dateError}
            </div>
          )}

          {/* --- Suite --- */}
          {/* --- Drop déclaration PDF --- */}
          <div className="sm:col-span-2">
            {/* Bandeau d'entête : indication + bouton bascule manuel */}
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7B0503]">
                Déclaration PDF (optionnelle)
              </p>
              <button
                type="button"
                onClick={() => setManualMode((m) => !m)}
                className="text-xs text-gray-500 underline-offset-2 hover:text-[#7B0503] hover:underline"
              >
                {manualMode ? "Masquer la saisie manuelle" : "Saisie manuelle"}
              </button>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setPdfDrag(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setPdfDrag(false);
              }}
              onDrop={onPdfDrop}
              onClick={() => !pdfBusy && fileInputRef.current?.click()}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition-all ${pdfDrag
                ? "border-[#7B0503] bg-[#fdf2f1]"
                : "border-gray-300 bg-gray-50 hover:border-[#7B0503]/50 hover:bg-gray-100"
                } ${pdfBusy ? "pointer-events-none opacity-60" : ""}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                {pdfBusy ? (
                  <Loader2 size={18} className="animate-spin text-[#7B0503]" />
                ) : (
                  <Upload size={18} className="text-[#7B0503]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#303334]">
                  {pdfBusy
                    ? pdfStep || "Analyse en cours…"
                    : "Déposer la déclaration PDF ici"}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {pdfBusy
                    ? "Gemini lit le document…"
                    : "Auto-remplit le Type et le Montant selon la déclaration"}
                </p>
              </div>
              {!pdfBusy && (
                <FileText size={16} className="shrink-0 text-gray-400" />
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={onPdfChange}
              className="hidden"
            />

            {pdfError && (
              <p className="mt-2 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircleIcon size={14} className="mt-0.5 shrink-0" />
                {pdfError}
              </p>
            )}

            {pdfInfo && !pdfError && (
              <div className="mt-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
                <p className="font-semibold">
                  ✓ Déclaration lue — {pdfInfo.raisonSociale}
                </p>
                <p className="mt-0.5 text-green-700">
                  Montant : {pdfInfo.montant.toLocaleString("fr-FR")} DH ·{" "}
                  {pdfInfo.type}
                  {pdfInfo.model && (
                    <span className="ml-2 text-green-600">
                      ({pdfInfo.model})
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Bandeau mode manuel (visible si IA en échec OU activé par l'utilisateur) */}
            {(manualMode || pdfError) && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span className="text-base leading-none">✎</span>
                <div className="flex-1">
                  <p className="font-semibold">
                    Mode manuel {pdfError ? "— l'IA n'a pas pu lire le PDF" : "activé"}
                  </p>
                  <p className="mt-0.5 text-amber-700">
                    Remplissez le Type et le Montant ci-dessous manuellement.
                  </p>
                </div>
                {!pdfError && (
                  <button
                    type="button"
                    onClick={() => setManualMode(false)}
                    className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  >
                    Masquer
                  </button>
                )}
              </div>
            )}
          </div>

          {/* --- Suite --- */}
          <Field label="Type d'attestation">
            <select
              className={`${inputCls} ${manualMode
                ? "border-amber-400 !bg-amber-50"
                : ""
                }`}
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
              className={`${inputCls} ${!preview.avecRetard
                  ? "cursor-not-allowed !bg-gray-200 text-gray-400"
                  : manualMode
                    ? "border-amber-400 !bg-amber-50"
                    : ""
                }`}
              value={form.montantText}
              onChange={set("montantText")}
              disabled={!preview.avecRetard}
              placeholder={
                preview.avecRetard ? "Entrer le Montant en DH" : ""
              }
            />
          </Field>

          <ReadOnlyField label="Qualité du signataire">
            {form.qualite || <span className="text-red-600">—</span>}
          </ReadOnlyField>

          <ReadOnlyField label="Nom & Prénom du signataire">
            {form.signataire || <span className="text-red-600">—</span>}
          </ReadOnlyField>

          <ReadOnlyField label="Lieu">
            {form.lieu || <span className="text-gray-400">—</span>}
          </ReadOnlyField>

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