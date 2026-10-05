// src/components/ClientsTableEditor.jsx
import { useMemo, useState } from "react";
import { Plus, Trash2, Save, X, Upload } from "lucide-react";
import {
  loadCabinet,
  upsertClient,
  deleteClient,
} from "../lib/cabinetStore";
import ImportConfigExcelModal from "./ImportConfigExcelModal";

const CIVILITES = ["", "H", "F"];

/* Ligne d'édition inline ---------------------------------------------- */

function EditableRow({ client, signataires, onSave, onDelete, onCancel }) {
  const [draft, setDraft] = useState(client);
  const set = (k) => (e) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  const inputCls =
    "w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-[#7B0503] focus:outline-none";

  return (
    <tr className="bg-yellow-50">
      <td className="border border-gray-200 px-2 py-1">
        <input
          className={inputCls}
          value={draft.raisonSociale ?? ""}
          onChange={set("raisonSociale")}
        />
      </td>
      <td className="border border-gray-200 px-2 py-1">
        <input
          className={inputCls}
          value={draft.adresse ?? ""}
          onChange={set("adresse")}
        />
      </td>
      <td className="border border-gray-200 px-2 py-1">
        <input
          className={inputCls}
          value={draft.representant ?? ""}
          onChange={set("representant")}
        />
      </td>
      <td className="border border-gray-200 px-2 py-1">
        <select
          className={inputCls}
          value={draft.civilite ?? ""}
          onChange={set("civilite")}
        >
          {CIVILITES.map((c) => (
            <option key={c} value={c}>
              {c === "" ? "—" : c === "H" ? "Homme" : "Femme"}
            </option>
          ))}
        </select>
      </td>
      <td className="border border-gray-200 px-2 py-1">
        <input
          className={inputCls}
          value={draft.qualiteRepresentant ?? ""}
          onChange={set("qualiteRepresentant")}
        />
      </td>
      <td className="border border-gray-200 px-2 py-1">
        <select
          className={inputCls}
          value={draft.signataireId ?? ""}
          onChange={set("signataireId")}
        >
          <option value="">— Choisir —</option>
          {signataires.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nom} ({s.qualite})
            </option>
          ))}
        </select>
      </td>
      <td className="border border-gray-200 px-2 py-1 text-center">
        <div className="flex justify-center gap-1">
          <button
            onClick={() => onSave(draft)}
            className="rounded-md bg-green-600 p-1 text-white hover:bg-green-700"
            title="Enregistrer"
          >
            <Save size={14} />
          </button>
          <button
            onClick={onCancel}
            className="rounded-md bg-gray-400 p-1 text-white hover:bg-gray-500"
            title="Annuler"
          >
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* Tableau principal --------------------------------------------------- */

export default function ClientsTableEditor({ cabinet, onChange }) {
  const [editingId, setEditingId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [filter, setFilter] = useState("");

  const clients = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return cabinet.clients;
    return cabinet.clients.filter((c) =>
      (c.raisonSociale ?? "").toLowerCase().includes(q),
    );
  }, [cabinet.clients, filter]);

  const handleSave = (draft) => {
    upsertClient(draft);
    setEditingId(null);
    onChange();
  };

  const handleDelete = (id) => {
    if (!confirm("Supprimer ce client ?")) return;
    deleteClient(id);
    onChange();
  };

  const addNew = () => {
    const created = upsertClient({
      raisonSociale: "Nouveau client",
      adresse: "",
      representant: "",
      civilite: "",
      qualiteRepresentant: "",
      signataireId: cabinet.signataires[0]?.id ?? "",
    });
    onChange();
    setEditingId(created.id);
  };

  const thCls =
    "border border-gray-200 bg-[#EEEEEE] px-2 py-1.5 text-left text-xs font-semibold text-[#7B0503]";

  return (
    <div>
      {/* Barre d'actions */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={addNew}
          className="inline-flex items-center gap-1 rounded-lg bg-[#7B0503] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#b80704]"
        >
          <Plus size={14} />
          Ajouter un client
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-[#EEEEEE] px-3 py-1.5 text-sm hover:bg-[#C5C1C1]"
        >
          <Upload size={14} />
          Importer Excel
        </button>
        <input
          placeholder="Filtrer par raison sociale…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="ml-auto w-64 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-[#7B0503] focus:outline-none"
        />
        <span className="text-xs text-gray-500">
          {cabinet.clients.length} client(s)
        </span>
      </div>

      {/* Tableau */}
      <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-300">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={thCls}>Raison sociale</th>
              <th className={thCls}>Adresse</th>
              <th className={thCls}>Représentant</th>
              <th className={thCls}>Civilité</th>
              <th className={thCls}>Qualité rép.</th>
              <th className={thCls}>Signataire</th>
              <th className={thCls + " w-20 text-center"}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-sm text-gray-500"
                >
                  Aucun client. Ajoute-en un ou importe un Excel.
                </td>
              </tr>
            )}
            {clients.map((c) =>
              editingId === c.id ? (
                <EditableRow
                  key={c.id}
                  client={c}
                  signataires={cabinet.signataires}
                  onSave={handleSave}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => handleDelete(c.id)}
                />
              ) : (
                <tr
                  key={c.id}
                  className="cursor-pointer even:bg-gray-50 hover:bg-blue-50"
                  onClick={() => setEditingId(c.id)}
                >
                  <td className="border border-gray-200 px-2 py-1 font-medium">
                    {c.raisonSociale}
                  </td>
                  <td className="border border-gray-200 px-2 py-1 text-gray-600">
                    {c.adresse || "—"}
                  </td>
                  <td className="border border-gray-200 px-2 py-1">
                    {c.representant || "—"}
                  </td>
                  <td className="border border-gray-200 px-2 py-1">
                    {c.civilite === "H"
                      ? "Homme"
                      : c.civilite === "F"
                        ? "Femme"
                        : "—"}
                  </td>
                  <td className="border border-gray-200 px-2 py-1">
                    {c.qualiteRepresentant || "—"}
                  </td>
                  <td className="border border-gray-200 px-2 py-1">
                    {cabinet.signataires.find((s) => s.id === c.signataireId)
                      ?.nom ?? (
                      <span className="text-red-600">Non associé</span>
                    )}
                  </td>
                  <td className="border border-gray-200 px-2 py-1 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(c.id);
                      }}
                      className="rounded-md p-1 text-red-600 hover:bg-red-50"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {showImport && (
        <ImportConfigExcelModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}