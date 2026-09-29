import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadSelection } from "../lib/selectionStore";
import {
  signatureKey,
  loadSignature,
  saveSignature,
  deleteSignature,
  fileToSignature,
} from "../lib/signatureStore";
import { generateAll } from "../lib/generateAttestation";

const rows = (e) => [
  ["Adresse", e.adresse],
  ["PDG", `${e.civilite} ${e.pdg}`.trim()],
  ["Sexe du PDG", e.sexePdg],
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
      if (!saveSignature(key, sig)) throw new Error("Stockage local plein ou indisponible");
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
          <span className="text-sm text-amber-700">Aucune signature enregistrée</span>
        )}
        <label className="cursor-pointer rounded-lg bg-[#EEEEEE] px-3 py-1 text-sm hover:bg-[#C5C1C1]">
          {signature ? "Remplacer" : "Importer la signature"}
          <input type="file" accept="image/*" onChange={onFile} className="hidden" />
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
          Enregistrée sous « {key.replace("signature:", "")} » : réutilisée automatiquement.
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SelectionPage() {
  const data = useMemo(() => loadSelection(), []);
  const list = data?.entreprises ?? [];
  const [, setVersion] = useState(0); // force le rafraîchissement après upload/suppression
  const refresh = () => setVersion((v) => v + 1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const sigOf = (e) => loadSignature(signatureKey(e.signataire, e.qualiteSignataire));
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
              {list.length} entreprise(s) · {data.fichier} · feuille « {data.feuille} »
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link to="/" className="rounded-lg bg-[#EEEEEE] px-3 py-1 text-sm hover:bg-[#C5C1C1]">
            ← Retour
          </Link>
          <button
            onClick={generate}
            disabled={!list.length || missing.length > 0 || busy}
            className="rounded-lg bg-blue-600 px-4 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Génération…" : "Générer les attestations"}
          </button>
        </div>
      </div>

      {missing.length > 0 && (
        <p className="mb-3 text-sm text-amber-700">
          {missing.length} signature(s) manquante(s) : importez-les pour activer la génération.
        </p>
      )}
      {result && (
        <div className="mb-3 space-y-1 text-sm">
          {result.count > 0 && (
            <p className="text-green-700">{result.count} attestation(s) générée(s).</p>
          )}
          {result.errors.map((m) => (
            <p key={m} className="text-red-600">⚠ {m}</p>
          ))}
        </div>
      )}

      {!list.length ? (
        <p className="text-sm text-gray-500">Aucune entreprise sélectionnée.</p>
      ) : (
        <div className="space-y-4">
          {list.map((e) => (
            <article key={e.ligneExcel} className="rounded-lg border border-gray-300 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{e.raisonSociale}</h2>
                <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">{e.template}</code>
              </div>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {rows(e).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
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
              <SignatureBox entreprise={e} signature={sigOf(e)} onChange={refresh} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default SelectionPage;