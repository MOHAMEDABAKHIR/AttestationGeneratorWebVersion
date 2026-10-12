import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Layers,
  X,
  CheckCircle2,
  Upload,
} from "lucide-react";

import { loadSelection } from "../lib/selectionStore";
import {
  signatureKey,
  loadSignature,
  saveSignature,
  deleteSignature,
  fileToSignature,
} from "../lib/signatureStore";
import {
  generateAll,
  downloadBlob,
  attestationDeclarationPdfFileName,
} from "../lib/generateAttestation";
import { mergePdfBlobs } from "../lib/pdfExport";

const rows = (e) => [
  ["Adresse", e.adresse],
  ["Représentant", `${e.civilite} ${e.representant}`.trim()],
  ["Civilité du représentant", e.sexeRepresentant],
  ["Qualité du représentant", e.qualiteRepresentant],
  ["Exercice", e.exercice],
  ["Trimestre", e.trimestre],
  ["Période", e.periode?.libelle],
  ["Type d'attestation", e.typeAttestation],
  ["Montant (DH)", e.montant],
  ["Qualité du signataire", e.qualiteSignataire],
  ["Signataire", e.signataire],
  ["Lieu", e.lieu],
  ["Date de signature", e.dateSignature],
];

function SignatureBox({ entreprise, signature, onChange }) {
  const key = signatureKey(entreprise.signataire, entreprise.qualiteSignataire);
  const [error, setError] = useState("");

  const onFile = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    try {
      const sig = await fileToSignature(file);
      if (!saveSignature(key, sig))
        throw new Error("Stockage local plein ou indisponible");
      setError("");
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        Signature de {entreprise.signataire} ({entreprise.qualiteSignataire})
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {signature ? (
          <img
            src={signature.dataUrl}
            alt="Signature"
            className="h-16 rounded border border-gray-200 bg-white p-1"
          />
        ) : (
          <span className="text-sm text-amber-700">
            Aucune signature enregistrée
          </span>
        )}
        <label className="cursor-pointer rounded-lg bg-[#EEEEEE] px-3 py-1 text-sm hover:bg-[#C5C1C1]">
          {signature ? "Remplacer" : "Importer la signature"}
          <input
            type="file"
            accept="image/*"
            onChange={onFile}
            className="hidden"
          />
        </label>
        {signature && (
          <button
            className="text-sm text-red-600 hover:underline"
            onClick={() => {
              deleteSignature(key);
              onChange();
            }}
          >
            Supprimer
          </button>
        )}
      </div>
      {signature && (
        <p className="mt-1 text-xs text-gray-500">
          Enregistrée sous « {key.replace("signature:", "")} » : réutilisée
          automatiquement.
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modale de fusion PDF                                               */
/* ------------------------------------------------------------------ */

function PdfPicker({ label, file, onPick }) {
  const ref = useRef(null);
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[#7B0503]">
        {label}
      </div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-left text-sm hover:border-[#7B0503]/50 hover:bg-gray-100"
      >
        <Upload size={14} className="shrink-0 text-[#7B0503]" />
        <span className="min-w-0 flex-1 truncate">
          {file ? file.name : "Choisir un fichier PDF…"}
        </span>
        {file && <CheckCircle2 size={14} className="shrink-0 text-green-600" />}
      </button>
      <input
        ref={ref}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={onPick}
      />
    </div>
  );
}

function MergePdfModal({ entreprise, onClose }) {
  const [attestation, setAttestation] = useState(null);
  const [declaration, setDeclaration] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isPdf = (f) =>
    f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name));

  const pick = (setter) => (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!isPdf(f)) {
      setError("Veuillez sélectionner un fichier PDF.");
      return;
    }
    setError("");
    setter(f);
  };

  const handleMerge = async () => {
    if (!attestation || !declaration) {
      setError("Sélectionnez les deux PDF pour fusionner.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Ordre : attestation en premier, déclaration ensuite
      const merged = await mergePdfBlobs([attestation, declaration]);
      downloadBlob(merged, attestationDeclarationPdfFileName(entreprise));
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || "Fusion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdf2f1]">
              <Layers size={20} className="text-[#7B0503]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Fusionner deux PDF</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {entreprise.raisonSociale}
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

        <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Importez l'attestation PDF (générée à partir du Word exporté) et la
          déclaration PDF. Ordre de fusion :{" "}
          <strong>attestation</strong> puis <strong>déclaration</strong>.
        </p>

        <div className="space-y-4">
          <PdfPicker
            label="1 · Attestation PDF"
            file={attestation}
            onPick={pick(setAttestation)}
          />
          <PdfPicker
            label="2 · Déclaration PDF"
            file={declaration}
            onPick={pick(setDeclaration)}
          />
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
            type="button"
            onClick={handleMerge}
            disabled={busy || !attestation || !declaration}
            className="rounded-lg bg-[#7B0503] px-4 py-2 text-sm font-medium text-white hover:bg-[#b80704] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Fusion…" : "Fusionner et télécharger"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SelectionPage() {
  const data = useMemo(() => loadSelection(), []);
  const list = data?.entreprises ?? [];
  const [, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // Entreprise en cours de fusion (ouvre la modale)
  const [mergeFor, setMergeFor] = useState(null);

  const sigOf = (e) =>
    loadSignature(signatureKey(e.signataire, e.qualiteSignataire));
  const missing = list.filter((e) => !sigOf(e));

  const generate = async () => {
    setBusy(true);
    setResult(null);
    try {
      setResult(await generateAll(list, sigOf));
    } catch (err) {
      setResult({ count: 0, errors: [err.message] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6 mb-17">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Entreprises sélectionnées</h1>
          {data && (
            <p className="text-sm text-gray-600">
              {list.length} entreprise(s) · {data.fichier} · feuille «{" "}
              {data.feuille} »
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            to="/"
            className="rounded-lg bg-[#EEEEEE] px-3 py-1 text-sm hover:bg-[#C5C1C1]"
          >
            ← Retour
          </Link>
          <button
            onClick={generate}
            disabled={!list.length || missing.length > 0 || busy}
            className="rounded-lg bg-[#7B0503] px-4 py-1 text-sm font-medium text-white hover:bg-[#b80704] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Génération…" : "Générer"}
          </button>
        </div>
      </div>

      {missing.length > 0 && (
        <p className="mb-3 text-sm text-amber-700">
          {missing.length} signature(s) manquante(s) : importez-les pour activer
          la génération.
        </p>
      )}
      {result && (
        <div className="mb-3 space-y-1 text-sm">
          {result.count > 0 && (
            <p className="text-green-700">
              {result.count} attestation(s) générée(s).
            </p>
          )}
          {result.errors.map((m) => (
            <p key={m} className="text-red-600">
              ⚠ {m}
            </p>
          ))}
        </div>
      )}

      {!list.length ? (
        <p className="text-sm text-gray-500">
          Aucune entreprise sélectionnée.
        </p>
      ) : (
        <div className="space-y-4">
          {list.map((e) => (
            <article
              key={e.ligneExcel}
              className="rounded-lg border border-gray-300 p-5"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{e.raisonSociale}</h2>
                <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                  {e.template}
                </code>
              </div>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {rows(e).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-wide font-semibold text-[#7B0503]">
                      {label}
                    </dt>
                    <dd className="text-sm">
                      {value === null || value === "" || value === undefined ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        String(value)
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Fusion PDF */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMergeFor(e)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#7B0503] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#b80704]"
                  title="Fusionner l'attestation PDF avec la déclaration PDF"
                >
                  <Layers size={14} />
                  Fusionner PDF + Déclaration
                </button>
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <FileText size={12} />
                  Générez d'abord le Word, convertissez-le en PDF, puis
                  importez les deux PDF dans la modale de fusion.
                </span>
              </div>

              <SignatureBox
                entreprise={e}
                signature={sigOf(e)}
                onChange={refresh}
              />
            </article>
          ))}
        </div>
      )}

      {mergeFor && (
        <MergePdfModal
          entreprise={mergeFor}
          onClose={() => setMergeFor(null)}
        />
      )}
    </div>
  );
}

export default SelectionPage;