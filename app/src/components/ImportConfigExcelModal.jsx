// src/components/ImportConfigExcelModal.jsx
import { useState } from "react";
import * as XLSX from "xlsx";
import { X, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { loadCabinet, upsertClient, normRaison } from "../lib/cabinetStore";

// Colonnes attendues (dans l'ordre ou nommées) :
// Raison sociale | Adresse | Représentant | Civilité | Qualité représentant | Signataire
const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const HEADER_MAP = {
  raisonsociale: "raisonSociale",
  nomdelentreprise: "raisonSociale",
  entreprise: "raisonSociale",
  adresse: "adresse",
  adressedelasociete: "adresse",
  representant: "representant",
  nomrepresentant: "representant",
  nomdurepresentant: "representant",
  civilite: "civilite",
  sexe: "civilite",
  qualiterepresentant: "qualiteRepresentant",
  qualitedurepresentant: "qualiteRepresentant",
  signataire: "signataireName",
  nomsignataire: "signataireName",
  nomprenom: "signataireName",
};

export default function ImportConfigExcelModal({ onClose, onImported }) {
  const cabinet = loadCabinet();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        blankrows: false,
      });
      if (aoa.length < 2) {
        throw new Error("Le fichier semble vide.");
      }
      const headers = aoa[0].map(norm);
      const map = headers.map((h) => HEADER_MAP[h] ?? null);

      const parsed = aoa
        .slice(1)
        .map((r) => {
          const o = {};
          map.forEach((key, i) => {
            if (key) o[key] = String(r[i] ?? "").trim();
          });
          return o;
        })
        .filter((o) => o.raisonSociale);

      if (!parsed.length) {
        throw new Error(
          "Aucune ligne exploitable. Vérifiez les en-têtes du fichier.",
        );
      }
      setRows(parsed);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const importAll = () => {
    if (!rows) return;
    setBusy(true);
    try {
      for (const r of rows) {
        // Retrouve le signataireId à partir du nom (si fourni)
        let signataireId = "";
        if (r.signataireName) {
          const target = normRaison(r.signataireName);
          const s = cabinet.signataires.find(
            (x) => normRaison(x.nom) === target,
          );
          if (s) signataireId = s.id;
        }
        // Sinon : signataire unique -> on l'associe d'office
        if (!signataireId && cabinet.signataires.length === 1) {
          signataireId = cabinet.signataires[0].id;
        }

        // Met à jour si la raison sociale existe déjà
        const existing = cabinet.clients.find(
          (c) => normRaison(c.raisonSociale) === normRaison(r.raisonSociale),
        );

        upsertClient({
          id: existing?.id,
          raisonSociale: r.raisonSociale,
          adresse: r.adresse ?? existing?.adresse ?? "",
          representant: r.representant ?? existing?.representant ?? "",
          civilite: r.civilite ?? existing?.civilite ?? "",
          qualiteRepresentant:
            r.qualiteRepresentant ?? existing?.qualiteRepresentant ?? "",
          signataireId: signataireId || existing?.signataireId || "",
        });
      }
      onImported();
    } catch (err) {
      console.error(err);
      setError("Import échoué : " + err.message);
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
        className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Importer une configuration Excel
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Colonnes attendues : Raison sociale, Adresse, Représentant,
              Civilité (H/F), Qualité représentant, Signataire
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 hover:bg-gray-100">
          <Upload size={22} className="text-[#7B0503]" />
          <span className="mt-2 text-sm font-semibold">
            Cliquez pour choisir un fichier Excel
          </span>
          <span className="mt-1 text-xs text-gray-500">.xlsx, .xls, .xlsm</span>
          <input
            type="file"
            accept=".xlsx,.xls,.xlsm"
            onChange={onFile}
            className="hidden"
          />
        </label>

        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5" />
            {error}
          </p>
        )}

        {rows && (
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 size={16} />
              {rows.length} ligne(s) détectée(s)
            </p>
            <div className="max-h-60 overflow-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#EEEEEE]">
                  <tr>
                    <th className="px-2 py-1 text-left">Raison sociale</th>
                    <th className="px-2 py-1 text-left">Adresse</th>
                    <th className="px-2 py-1 text-left">Représentant</th>
                    <th className="px-2 py-1 text-left">Civ.</th>
                    <th className="px-2 py-1 text-left">Qualité</th>
                    <th className="px-2 py-1 text-left">Signataire</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="even:bg-gray-50">
                      <td className="px-2 py-1">{r.raisonSociale}</td>
                      <td className="px-2 py-1">{r.adresse || "—"}</td>
                      <td className="px-2 py-1">{r.representant || "—"}</td>
                      <td className="px-2 py-1">{r.civilite || "—"}</td>
                      <td className="px-2 py-1">
                        {r.qualiteRepresentant || "—"}
                      </td>
                      <td className="px-2 py-1">{r.signataireName || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg bg-[#EEEEEE] px-4 py-2 text-sm hover:bg-[#C5C1C1]"
          >
            Annuler
          </button>
          <button
            disabled={!rows || busy}
            onClick={importAll}
            className="rounded-lg bg-[#7B0503] px-4 py-2 text-sm font-medium text-white hover:bg-[#b80704] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Import…" : `Importer ${rows?.length ?? 0} ligne(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}