// src/components/ImportDeclaration.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";

import { extractDeclaration } from "../lib/extractDeclaration";
import { resolveClient } from "../lib/cabinetStore";
import { saveSelection, loadSelection } from "../lib/selectionStore";
import ClientNotFoundModal from "./ClientNotFoundModal";
import DeclarationResultCard from "./DeclarationResultCard";

/* ------------------------------------------------------------------ */

function StepRow({ label, status }) {
  const icon =
    status === "done" ? (
      <CheckCircle2 size={16} className="text-green-600" />
    ) : status === "current" ? (
      <Loader2 size={16} className="animate-spin text-[#7B0503]" />
    ) : (
      <span className="inline-block h-4 w-4 rounded-full border border-gray-300" />
    );
  return (
    <li className="flex items-center gap-2 text-sm text-gray-700">
      {icon}
      <span>{label}</span>
    </li>
  );
}

/* ------------------------------------------------------------------ */

export default function ImportDeclaration() {
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(""); // message d'étape
  const [error, setError] = useState("");

  // Résultat de l'extraction IA/PDF
  const [extracted, setExtracted] = useState(null);
  // Résolution dans le cabinet
  const [resolved, setResolved] = useState(null); // { client, signataire } | null
  // Contrôle du modal "client inconnu"
  const [showNotFound, setShowNotFound] = useState(false);

  /* ---------------- Drag & drop ---------------- */

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    await processFile(f);
  };

  const onFileChange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    await processFile(f);
  };

  /* ---------------- Pipeline ---------------- */

  const processFile = async (f) => {
    setError("");
    setExtracted(null);
    setResolved(null);

    if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) {
      setError("Veuillez sélectionner un fichier PDF.");
      return;
    }

    setFile(f);
    setBusy(true);

    try {
      setStep("Extraction des champs du PDF…");
      const result = await extractDeclaration(f, {
        onStep: (msg) => setStep(msg),
      });

      if (!result.raisonSociale && !result.adresse) {
        throw new Error(
          "Aucun champ exploitable n'a été trouvé dans ce PDF. " +
            (result._error ? `(IA: ${result._error})` : ""),
        );
      }

      setExtracted(result);

      setStep("Recherche du client dans la configuration…");
      const r = resolveClient(result.raisonSociale || "");
      setResolved(r);

      if (!r) {
        setShowNotFound(true);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible de traiter ce PDF.");
    } finally {
      setBusy(false);
      setStep("");
    }
  };

  /* ---------------- Modal "client inconnu" ---------------- */

  const handleClientAdded = (newResolved) => {
    setResolved(newResolved);
    setShowNotFound(false);
  };

  /* ---------------- Ajout à la sélection ---------------- */

  const addToSelection = (record) => {
    // On fusionne avec la sélection existante si elle existe
    const current = loadSelection();
    const entreprises = current?.entreprises ?? [];
    // Évite les doublons sur raisonSociale + ligneExcel n'existe pas ici
    const exists = entreprises.some(
      (e) => e.raisonSociale === record.raisonSociale,
    );
    const next = exists ? entreprises : [...entreprises, record];

    saveSelection({
      fichier: current?.fichier ?? file?.name ?? "declaration.pdf",
      feuille: current?.feuille ?? "Déclaration PDF",
      entreprises: next,
    });

    navigate("/selection");
  };

  const reset = () => {
    setFile(null);
    setExtracted(null);
    setResolved(null);
    setError("");
    setShowNotFound(false);
  };

  /* ---------------- Rendu ---------------- */

  return (
    <div className="space-y-6">
      {/* Carte d'import */}
      <section className="app-card overflow-hidden">
        <div className="border-b border-[#e8eae9] px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
              <FileText size={22} className="text-[#7B0503]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#252728]">
                Importer une déclaration PDF
              </h2>
              <p className="mt-1 text-sm text-[#74797a]">
                La déclaration est analysée localement puis, si nécessaire,
                complétée par l'IA. Les données sensibles sont anonymisées
                avant tout envoi.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <label
            htmlFor="pdf-declaration"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`
              group flex min-h-[200px] cursor-pointer flex-col items-center
              justify-center rounded-2xl border-2 border-dashed px-6 py-10
              text-center transition-all
              ${
                isDragging
                  ? "border-[#7B0503] bg-[#fdf2f1]"
                  : "border-[#dfe2e1] bg-[#fafafa] hover:border-[#b9bfbd] hover:bg-[#f7f7f6]"
              }
              ${busy ? "pointer-events-none opacity-60" : ""}
            `}
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
              {busy ? (
                <Loader2
                  size={24}
                  className="animate-spin text-[#7B0503]"
                />
              ) : (
                <Upload
                  size={24}
                  strokeWidth={1.8}
                  className="text-[#7B0503] transition-transform group-hover:-translate-y-0.5"
                />
              )}
            </div>
            <p className="text-sm font-semibold text-[#303334]">
              {busy
                ? "Traitement en cours…"
                : "Déposez la déclaration PDF ici"}
            </p>
            <p className="mt-1 text-sm text-[#858a8b]">
              {busy
                ? step || "Veuillez patienter"
                : "ou cliquez pour parcourir vos fichiers"}
            </p>
            {!busy && (
              <span className="mt-4 rounded-full bg-[#eeeeed] px-3 py-1 text-[11px] font-medium text-[#737879]">
                .pdf uniquement
              </span>
            )}
          </label>

          <input
            id="pdf-declaration"
            type="file"
            accept=".pdf,application/pdf"
            onChange={onFileChange}
            className="hidden"
            disabled={busy}
          />

          {/* Étapes du chargement */}
          {busy && (
            <ul className="mt-4 space-y-1">
              <StepRow label="Lecture du PDF" status="done" />
              <StepRow label="Extraction des champs" status="current" />
              <StepRow label="Recherche dans la configuration" status="" />
            </ul>
          )}

          {/* Erreur */}
          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#f0c7c4] bg-[#fff5f4] px-4 py-3">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-[#c0392b]"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#9f3028]">
                  Traitement impossible
                </p>
                <p className="mt-0.5 text-sm text-[#a9554e]">{error}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Fichier chargé + bouton reset */}
      {file && !busy && (
        <section className="app-card px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <CheckCircle2 size={18} className="shrink-0 text-[#16845b]" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#16845b]">
                  Déclaration analysée
                </p>
                <p className="truncate text-sm font-semibold text-[#252728]">
                  {file.name}
                </p>
                {extracted?.source && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    Source :{" "}
                    {extracted.source === "pdfjs"
                      ? "analyse locale (PDF.js)"
                      : extracted.source === "gemini"
                        ? "IA Gemini"
                        : "analyse locale + IA"}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#858a8b] transition-colors hover:bg-[#f4f4f3] hover:text-[#7B0503]"
              title="Retirer le fichier"
              aria-label="Retirer le fichier"
            >
              <X size={18} />
            </button>
          </div>
        </section>
      )}

      {/* Résultat + carte éditable */}
      {extracted && !busy && (
        <DeclarationResultCard
          extracted={extracted}
          client={resolved?.client ?? null}
          signataire={resolved?.signataire ?? null}
          onAddToSelection={addToSelection}
          onRequestLink={() => setShowNotFound(true)}
        />
      )}

      {/* Modal client inconnu */}
      {showNotFound && extracted && (
        <ClientNotFoundModal
          extracted={extracted}
          onClose={() => setShowNotFound(false)}
          onAdded={handleClientAdded}
        />
      )}
    </div>
  );
}