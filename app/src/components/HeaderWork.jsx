import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

import {
  Upload,
  FileSpreadsheet,
  Layers3,
  Rows3,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

import logoExcel from "../assets/logoExcel.png";

import ExcelTable from "./ExcelTable";
import EntrepriseDetails from "./EntrepriseDetails";

import { clearSelection } from "../lib/selectionStore";

function HeaderWork() {
  const [file, setFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  // =========================================================
  // IMPORT EXCEL
  // =========================================================

  const handleFile = async (selectedFile) => {
    if (!selectedFile) return;

    setError("");
    setFile(selectedFile);
    clearSelection();

    try {
      const buffer = await selectedFile.arrayBuffer();

      const wb = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      });

      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      setSelectedSheet(wb.SheetNames[0] ?? "");
    } catch (err) {
      console.error("Erreur de lecture du fichier :", err);

      setError(
        "Impossible de lire ce fichier Excel. Vérifiez que le fichier n'est pas corrompu."
      );

      setWorkbook(null);
      setSheetNames([]);
      setSelectedSheet("");
    }
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) return;

    await handleFile(selectedFile);
  };

  // =========================================================
  // DRAG & DROP
  // =========================================================

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];

    if (!droppedFile) return;

    const isExcelFile =
      /\.(xlsx|xls|xlsm)$/i.test(droppedFile.name);

    if (!isExcelFile) {
      setError(
        "Veuillez sélectionner un fichier Excel (.xlsx, .xls ou .xlsm)."
      );
      return;
    }

    await handleFile(droppedFile);
  };

  // =========================================================
  // INFORMATIONS DU FICHIER
  // =========================================================

  const sheetInfo = useMemo(() => {
    if (!workbook || !selectedSheet) {
      return {
        rows: 0,
        columns: 0,
      };
    }

    const sheet = workbook.Sheets[selectedSheet];

    if (!sheet || !sheet["!ref"]) {
      return {
        rows: 0,
        columns: 0,
      };
    }

    const range = XLSX.utils.decode_range(sheet["!ref"]);

    return {
      rows: range.e.r - range.s.r + 1,
      columns: range.e.c - range.s.c + 1,
    };
  }, [workbook, selectedSheet]);

  const removeFile = () => {
    setFile(null);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet("");
    setError("");
    clearSelection();
  };

  return (
    <div className="space-y-6">

      {/* =====================================================
          IMPORT CARD
      ===================================================== */}

      <section className="app-card overflow-hidden">

        {/* Header */}

        <div className="border-b border-[#e8eae9] px-6 py-5">

          <div className="flex items-start gap-4">

            <div
              className="
                flex h-11 w-11 shrink-0
                items-center justify-center
                rounded-xl
                
              "
            >
              <FileSpreadsheet
                size={22}
                className="text-[#7B0503]"
              />
            </div>

            <div>

              <h2 className="text-base font-semibold text-[#252728]">
                Importer un fichier Excel
              </h2>

              <p className="mt-1 text-sm text-[#74797a]">
                Sélectionnez le fichier contenant les données
                des entreprises à traiter.
              </p>

            </div>

          </div>

        </div>

        {/* Upload area */}

        <div className="p-6">

          <label
            htmlFor="excel-file"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              group
              flex min-h-[210px]
              cursor-pointer
              flex-col items-center justify-center
              rounded-2xl
              border-2 border-dashed
              px-6 py-10
              text-center
              transition-all

              ${
                isDragging
                  ? "border-[#7B0503] bg-[#fdf2f1]"
                  : "border-[#dfe2e1] bg-[#fafafa] hover:border-[#b9bfbd] hover:bg-[#f7f7f6]"
              }
            `}
          >

            <div
              className="
                mb-4
                flex h-14 w-14
                items-center justify-center
                rounded-2xl
                bg-white
                shadow-sm
              "
            >
              <Upload
                size={24}
                strokeWidth={1.8}
                className="
                  text-[#7B0503]
                  transition-transform
                  group-hover:-translate-y-0.5
                "
              />
            </div>

            <p className="text-sm font-semibold text-[#303334]">
              Déposez votre fichier Excel ici
            </p>

            <p className="mt-1 text-sm text-[#858a8b]">
              ou cliquez pour parcourir vos fichiers
            </p>

            <span className="mt-4 rounded-full bg-[#eeeeed] px-3 py-1 text-[11px] font-medium text-[#737879]">
              .xlsx · .xls · .xlsm
            </span>

          </label>

          <input
            id="excel-file"
            type="file"
            accept=".xlsx,.xls,.xlsm"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Error */}

          {error && (
            <div
              className="
                mt-4
                flex items-start gap-3
                rounded-xl
                border border-[#f0c7c4]
                bg-[#fff5f4]
                px-4 py-3
              "
            >
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-[#c0392b]"
              />

              <div className="flex-1">

                <p className="text-sm font-semibold text-[#9f3028]">
                  Import impossible
                </p>

                <p className="mt-0.5 text-sm text-[#a9554e]">
                  {error}
                </p>

              </div>

            </div>
          )}

        </div>

      </section>

      {/* =====================================================
          FILE SELECTED
      ===================================================== */}

      {file && workbook && (
        <section className="app-card">

          <div className="px-6 py-5">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              {/* File */}

              <div className="flex min-w-0 items-center gap-4">

                <div
                  className="
                    flex h-12 w-12 shrink-0
                    items-center justify-center
                    rounded-xl
                    
                  "
                >
                  <img
                    src={logoExcel}
                    alt=""
                    className="h-7 w-7 object-contain"
                  />
                </div>

                <div className="min-w-0">

                  <div className="flex items-center gap-2">

                    <CheckCircle2
                      size={16}
                      className="shrink-0 text-[#16845b]"
                    />

                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#16845b]">
                      Fichier chargé
                    </p>

                  </div>

                  <p
                    className="mt-1 truncate text-sm font-semibold text-[#252728]"
                    title={file.name}
                  >
                    {file.name}
                  </p>

                </div>

              </div>

              {/* Remove */}

              <button
                type="button"
                onClick={removeFile}
                className="
                  inline-flex
                  h-9 w-9
                  shrink-0
                  items-center justify-center
                  self-end
                  rounded-lg
                  text-[#858a8b]
                  transition-colors
                  hover:bg-[#f4f4f3]
                  hover:text-[#7B0503]
                  lg:self-auto
                "
                title="Retirer le fichier"
                aria-label="Retirer le fichier"
              >
                <X size={18} />
              </button>

            </div>

            {/* Stats */}

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">

              <div className="rounded-xl bg-[#f7f7f6] px-4 py-3">

                <div className="flex items-center gap-2 text-[#858a8b]">

                  <Layers3 size={16} />

                  <span className="text-xs font-medium">
                    Feuilles
                  </span>

                </div>

                <p className="mt-1 text-lg font-semibold text-[#252728]">
                  {sheetNames.length}
                </p>

              </div>

              <div className="rounded-xl bg-[#f7f7f6] px-4 py-3">

                <div className="flex items-center gap-2 text-[#858a8b]">

                  <Rows3 size={16} />

                  <span className="text-xs font-medium">
                    Lignes
                  </span>

                </div>

                <p className="mt-1 text-lg font-semibold text-[#252728]">
                  {sheetInfo.rows.toLocaleString("fr-FR")}
                </p>

              </div>

              <div className="rounded-xl bg-[#f7f7f6] px-4 py-3">

                <div className="flex items-center gap-2 text-[#858a8b]">

                  <FileSpreadsheet size={16} />

                  <span className="text-xs font-medium">
                    Colonnes
                  </span>

                </div>

                <p className="mt-1 text-lg font-semibold text-[#252728]">
                  {sheetInfo.columns}
                </p>

              </div>

            </div>

          </div>

          {/* Sheet selector */}

          {sheetNames.length > 0 && (
            <div
              className="
                border-t
                border-[#e8eae9]
                bg-[#fafafa]
                px-6 py-4
              "
            >

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <p className="text-sm font-semibold text-[#303334]">
                    Feuille active
                  </p>

                  <p className="mt-0.5 text-xs text-[#858a8b]">
                    Choisissez la feuille contenant les données à traiter.
                  </p>

                </div>

                <div className="relative min-w-[230px]">

                  <select
                    id="sheet-select"
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    className="
                      app-select
                      appearance-none
                      pr-10
                      cursor-pointer
                    "
                  >
                    {sheetNames.map((name) => (
                      <option
                        key={name}
                        value={name}
                      >
                        {name}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={17}
                    className="
                      pointer-events-none
                      absolute right-3 top-1/2
                      -translate-y-1/2
                      text-[#777c7d]
                    "
                  />

                </div>

              </div>

            </div>
          )}

        </section>
      )}

      {/* =====================================================
          EXCEL PREVIEW
      ===================================================== */}

      {workbook && selectedSheet && (
        <section>

          <div className="mb-4 flex items-end justify-between gap-4">

            <div>

              <div className="flex items-center gap-2">

                <div className="h-2 w-2 rounded-full bg-[#7B0503]" />

                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a8f90]">
                  Aperçu
                </p>

              </div>

              <h2 className="mt-1 text-lg font-semibold text-[#252728]">
                Données du fichier
              </h2>

              <p className="mt-1 text-sm text-[#74797a]">
                Vérifiez les données importées avant de poursuivre.
              </p>

            </div>

          </div>

          <ExcelTable
            key={`${file?.name}-${selectedSheet}`}
            workbook={workbook}
            sheetName={selectedSheet}
          />

        </section>
      )}

      {/* =====================================================
          COMPANY DETAILS
      ===================================================== */}

      {workbook && selectedSheet && (
        <section>

          <EntrepriseDetails
            key={`details-${file?.name}-${selectedSheet}`}
            workbook={workbook}
            sheetName={selectedSheet}
            fileName={file?.name}
          />

        </section>
      )}

    </div>
  );
}

export default HeaderWork;