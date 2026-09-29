import { useState } from "react";
import * as XLSX from "xlsx";
import logoExcel from "../assets/logoExcel.png";
import ExcelTable from "./ExcelTable";
import EntrepriseDetails from "./EntrepriseDetails";
import { clearSelection } from "../lib/selectionStore";

function HeaderWork() {
  const [file, setFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    clearSelection(); // nouveau fichier -> on vide la sélection

    try {
      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      setSelectedSheet(wb.SheetNames[0] ?? "");
    } catch (err) {
      console.error("Erreur de lecture du fichier :", err);
      setWorkbook(null);
      setSheetNames([]);
      setSelectedSheet("");
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 p-6">
        <label
          htmlFor="excel-file"
          className="flex justify-center items-center cursor-pointer rounded-lg bg-[#EEEEEE] text-black pr-2 py-1 hover:bg-[#C5C1C1]"
        >
          <img src={logoExcel} className="w-10 flex-1 border-r p-1 mr-1 border-black" />
          Importer le fichier Excel
        </label>

        <input
          id="excel-file"
          type="file"
          accept=".xlsx,.xls,.xlsm"
          onChange={handleFileChange}
          className="hidden"
        />

        {file && <p className="text-sm text-green-800">Fichier sélectionné : {file.name}</p>}

        {sheetNames.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="sheet-select" className="text-sm text-gray-700">
              Choisir une feuille :
            </label>
            <select
              id="sheet-select"
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
              className="rounded-lg bg-[#EEEEEE] px-2 py-1 text-black cursor-pointer hover:bg-[#C5C1C1]"
            >
              {sheetNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <ExcelTable key={`${file?.name}-${selectedSheet}`} workbook={workbook} sheetName={selectedSheet} />
      <EntrepriseDetails key={`details-${file?.name}-${selectedSheet}`} workbook={workbook} sheetName={selectedSheet} fileName={file?.name}/>
    </div>
  );
}

export default HeaderWork;