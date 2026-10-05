import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";

const formatCell = (v) => {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) return v.toLocaleDateString("fr-FR");
  if (typeof v === "number")
    return v.toLocaleString("fr-FR", {
      useGrouping: false,
      maximumFractionDigits: 10,
    });
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  return String(v);
};

const DENSITIES = {
  compact: "py-0.5 text-xs",
  normal: "py-1.5 text-sm",
  confortable: "py-3 text-sm",
};

function ExcelTable({ workbook, sheetName }) {
  const [firstRowHeader, setFirstRowHeader] = useState(true);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [density, setDensity] = useState("normal");
  const [height, setHeight] = useState(500);

  // Lecture de la feuille -> colonnes + données
  const { columns, data } = useMemo(() => {
    const sheet = workbook?.Sheets?.[sheetName];
    if (!sheet) return { columns: [], data: [] };

    const aoa = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });
    if (!aoa.length) return { columns: [], data: [] };

    const width = aoa.reduce((max, r) => Math.max(max, r.length), 0);
    const headerRow = firstRowHeader ? aoa[0] : [];
    const rows = firstRowHeader ? aoa.slice(1) : aoa;

    const columns = Array.from({ length: width }, (_, i) => ({
      id: `c${i}`,
      accessorKey: `c${i}`,
      header: String(headerRow[i] ?? "").trim() || `Colonne ${i + 1}`,
      size: 160,
      minSize: 60,
      cell: (info) => formatCell(info.getValue()),
    }));

    const data = rows.map((r) =>
      Object.fromEntries(
        Array.from({ length: width }, (_, i) => [`c${i}`, r[i] ?? ""]),
      ),
    );

    return { columns, data };
  }, [workbook, sheetName, firstRowHeader]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: (row, columnId, value) =>
      formatCell(row.getValue(columnId))
        .toLowerCase()
        .includes(String(value).toLowerCase()),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    initialState: { pagination: { pageSize:5 } },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const exportXlsx = () => {
    const cols = table.getVisibleLeafColumns();
    const aoa = [
      cols.map((c) => c.columnDef.header),
      ...table
        .getPrePaginationRowModel()
        .rows.map((r) => cols.map((c) => r.getValue(c.id))),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(aoa),
      sheetName.slice(0, 31),
    );
    XLSX.writeFile(wb, `${sheetName}_export.xlsx`);
  };

  if (!workbook || !sheetName) return null;
  if (!columns.length)
    return <p className="p-6 text-sm text-gray-500">Cette feuille est vide.</p>;

  const filteredCount = table.getPrePaginationRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const btn =
    "rounded-lg bg-[#EEEEEE] px-2 py-1 text-sm hover:bg-[#C5C1C1] disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col gap-3 px-6 pb-6">
      {/* Tableau */}
      <div
        className="overflow-auto rounded-lg border border-gray-300"
        style={{ maxHeight: height }}
      >
        <table
          className="border-collapse"
          style={{ width: table.getTotalSize() + 56, tableLayout: "fixed" }}
        >
          <thead className="sticky top-0 z-10 bg-[#EEEEEE]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                <th
                  className="sticky left-0 bg-[#EEEEEE] border border-gray-300 px-2 py-1.5 text-xs text-gray-500"
                  style={{ width: 56 }}
                ></th>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="relative select-none border border-gray-300 px-2 py-1.5 text-left text-sm font-semibold"
                  >
                    <div
                      onClick={header.column.getToggleSortingHandler()}
                      className="flex cursor-pointer items-center gap-1 truncate"
                      title={header.column.columnDef.header}
                    >
                      <span className="truncate">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </span>
                      <span className="text-xs">
                        {{ asc: "▲", desc: "▼" }[header.column.getIsSorted()] ??
                          ""}
                      </span>
                    </div>
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      onDoubleClick={() => header.column.resetSize()}
                      className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none hover:bg-blue-400 ${
                        header.column.getIsResizing() ? "bg-blue-500" : ""
                      }`}
                    />
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length + 1}
                  className="p-6 text-center text-sm text-gray-500"
                >
                  Aucun résultat.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="even:bg-gray-50 hover:bg-blue-50">
                  <td
                    className={`sticky left-0 border border-gray-200 bg-[#F7F7F7] px-2 text-center text-xs text-gray-500 ${DENSITIES[density]}`}
                  >
                    {row.index + 1 + (firstRowHeader ? 1 : 0)}
                  </td>
                  {row.getVisibleCells().map((cell) => {
                    const raw = cell.getValue();
                    return (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        title={formatCell(raw)}
                        className={`truncate border border-gray-200 px-2 ${DENSITIES[density]} ${
                          typeof raw === "number"
                            ? "text-right tabular-nums"
                            : ""
                        }`}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          className={btn}
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          «
        </button>
        <button
          className={btn}
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          ‹
        </button>
        <span>
          Page {pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
        </span>
        <button
          className={btn}
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          ›
        </button>
        <button
          className={btn}
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          »
        </button>

        <label className="ml-4 flex items-center gap-1">
          Lignes par page
          <select
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="rounded-lg bg-[#EEEEEE] px-2 py-1"
          >
            {[5,10, 25, 50, 100, 500].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export default ExcelTable;
