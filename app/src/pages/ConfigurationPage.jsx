// src/pages/ConfigurationPage.jsx
import { useCallback, useState } from "react";
import {
  Users,
  UserCheck,
  Download,
  Upload as UploadIcon,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  loadCabinet,
  exportCabinetJSON,
  importCabinetJSON,
} from "../lib/cabinetStore";
import ClientsTableEditor from "../components/ClientsTableEditor";
import SignatairesEditor from "../components/SignatairesEditor";

const TABS = [
  { id: "clients", label: "Clients", icon: Users },
  { id: "signataires", label: "Signataires", icon: UserCheck },
  { id: "io", label: "Import / Export", icon: Download },
];

export default function ConfigurationPage() {
  const [tab, setTab] = useState("clients");
  const [cabinet, setCabinet] = useState(() => loadCabinet());
  const [ioError, setIoError] = useState("");
  const [ioSuccess, setIoSuccess] = useState("");

  const refresh = useCallback(() => {
    setCabinet(loadCabinet());
  }, []);

  const handleImportJSON = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIoError("");
    setIoSuccess("");
    try {
      await importCabinetJSON(file);
      refresh();
      setIoSuccess("Configuration importée avec succès.");
    } catch (err) {
      setIoError(err.message);
    }
  };

  return (
    <div className="page-container">
      {/* En-tête */}
      <div className="page-header">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#7B0503]" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a8f90]">
              Cabinet mLExperts Audit &amp; Conseil
            </span>
          </div>
          <h1 className="page-header-title">Configuration</h1>
          <p className="page-header-description">
            Clients, signataires et signatures — stockés localement dans votre
            navigateur.
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className="mb-5 flex gap-1 border-b border-gray-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? "border-b-2 border-[#7B0503] text-[#7B0503]"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        {tab === "clients" && (
          <ClientsTableEditor cabinet={cabinet} onChange={refresh} />
        )}
        {tab === "signataires" && (
          <SignatairesEditor cabinet={cabinet} onChange={refresh} />
        )}
        {tab === "io" && (
          <div className="space-y-6">
            {/* Export */}
            <div className="rounded-xl border border-gray-200 p-5">
              <h3 className="mb-1 flex items-center gap-2 text-base font-semibold">
                <Download size={18} className="text-[#7B0503]" />
                Exporter la configuration
              </h3>
              <p className="mb-3 text-sm text-gray-600">
                Génère un fichier JSON contenant tous les clients, signataires
                et signatures. À conserver précieusement : il permet de
                restaurer ou transférer la configuration sur un autre poste.
              </p>
              <button
                onClick={exportCabinetJSON}
                className="inline-flex items-center gap-2 rounded-lg bg-[#7B0503] px-4 py-2 text-sm font-medium text-white hover:bg-[#b80704]"
              >
                <Download size={14} />
                Exporter la configuration cabinet.json
              </button>
            </div>

            {/* Import */}
            <div className="rounded-xl border border-gray-200 p-5">
              <h3 className="mb-1 flex items-center gap-2 text-base font-semibold">
                <UploadIcon size={18} className="text-[#7B0503]" />
                Importer une configuration
              </h3>
              <p className="mb-3 text-sm text-gray-600">
                <strong className="text-red-600">
                  Attention : l'import remplace intégralement
                </strong>{" "}
                la configuration actuelle (clients + signataires + signatures).
              </p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#EEEEEE] px-4 py-2 text-sm hover:bg-[#C5C1C1]">
                <UploadIcon size={14} />
                Choisir un fichier .json
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>

              {ioError && (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle size={16} className="mt-0.5" />
                  {ioError}
                </p>
              )}
              {ioSuccess && (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                  <RefreshCw size={16} className="mt-0.5" />
                  {ioSuccess}
                </p>
              )}
            </div>

            {/* Résumé */}
            <div className="rounded-xl bg-gray-50 px-5 py-4 text-sm text-gray-700">
              <p>
                <strong>État actuel :</strong> {cabinet.clients.length}{" "}
                client(s), {cabinet.signataires.length} signataire(s).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}