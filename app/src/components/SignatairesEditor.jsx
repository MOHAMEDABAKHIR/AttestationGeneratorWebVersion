// src/components/SignatairesEditor.jsx
import { useState } from "react";
import { Plus, Trash2, Upload, Check, X, ImageIcon } from "lucide-react";
import {
  upsertSignataire,
  deleteSignataire,
} from "../lib/cabinetStore";
import { fileToSignature } from "../lib/signatureStore";

const QUALITES = ["Expert-comptable", "Commissaire aux comptes"];

function SignatureUploader({ signataire, onChange }) {
  const [error, setError] = useState("");

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const sig = await fileToSignature(file);
      upsertSignataire({ ...signataire, signature: sig });
      setError("");
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeSig = () => {
    upsertSignataire({ ...signataire, signature: null });
    onChange();
  };

  return (
    <div className="flex items-center gap-3">
      {signataire.signature ? (
        <div className="flex items-center gap-2">
          <img
            src={signataire.signature.dataUrl}
            alt="Signature"
            className="h-12 rounded border border-gray-200 bg-white p-1"
          />
          <button
            onClick={removeSig}
            className="text-xs text-red-600 hover:underline"
          >
            Retirer
          </button>
        </div>
      ) : (
        <span className="flex items-center gap-1 text-xs text-amber-700">
          <ImageIcon size={14} /> Aucune signature
        </span>
      )}

      <label className="cursor-pointer rounded-lg bg-[#EEEEEE] px-2 py-1 text-xs hover:bg-[#C5C1C1]">
        {signataire.signature ? "Remplacer" : "Importer"}
        <input
          type="file"
          accept="image/*"
          onChange={onFile}
          className="hidden"
        />
      </label>

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export default function SignatairesEditor({ cabinet, onChange }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ nom: "", qualite: QUALITES[0] });

  const inputCls =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#7B0503] focus:outline-none";

  const handleAdd = () => {
    if (!draft.nom.trim()) return;
    upsertSignataire({
      nom: draft.nom.trim(),
      qualite: draft.qualite,
      signature: null,
    });
    setDraft({ nom: "", qualite: QUALITES[0] });
    setAdding(false);
    onChange();
  };

  const handleUpdate = (sig, patch) => {
    upsertSignataire({ ...sig, ...patch });
    onChange();
  };

  const handleDelete = (id) => {
    if (
      !confirm(
        "Supprimer ce signataire ? Les clients associés seront détachés.",
      )
    )
      return;
    deleteSignataire(id);
    onChange();
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {cabinet.signataires.length} signataire(s) configuré(s)
        </p>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-[#7B0503] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#b80704]"
        >
          <Plus size={14} />
          Ajouter un signataire
        </button>
      </div>

      {adding && (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-yellow-300 bg-yellow-50 p-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold uppercase text-[#7B0503]">
              Nom & Prénom
            </label>
            <input
              className={inputCls}
              value={draft.nom}
              onChange={(e) =>
                setDraft((d) => ({ ...d, nom: e.target.value }))
              }
              placeholder="Ex. Mehdi LAHLOU"
            />
          </div>
          <div className="min-w-[200px]">
            <label className="text-xs font-semibold uppercase text-[#7B0503]">
              Qualité
            </label>
            <select
              className={inputCls}
              value={draft.qualite}
              onChange={(e) =>
                setDraft((d) => ({ ...d, qualite: e.target.value }))
              }
            >
              {QUALITES.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
          >
            <Check size={14} /> Ajouter
          </button>
          <button
            onClick={() => setAdding(false)}
            className="rounded-lg bg-gray-300 px-3 py-2 text-sm hover:bg-gray-400"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="space-y-3">
        {cabinet.signataires.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
            Aucun signataire. Ajoute-en un pour pouvoir associer des clients.
          </p>
        )}

        {cabinet.signataires.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
          >
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs font-semibold uppercase text-[#7B0503]">
                Nom & Prénom
              </label>
              <input
                className={inputCls}
                value={s.nom}
                onChange={(e) => handleUpdate(s, { nom: e.target.value })}
              />
            </div>

            <div className="min-w-[200px]">
              <label className="text-xs font-semibold uppercase text-[#7B0503]">
                Qualité
              </label>
              <select
                className={inputCls}
                value={s.qualite}
                onChange={(e) => handleUpdate(s, { qualite: e.target.value })}
              >
                {QUALITES.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[240px]">
              <label className="text-xs font-semibold uppercase text-[#7B0503]">
                Signature
              </label>
              <SignatureUploader signataire={s} onChange={onChange} />
            </div>

            <button
              onClick={() => handleDelete(s.id)}
              className="ml-auto rounded-lg p-2 text-red-600 hover:bg-red-50"
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}