const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { existsSync } = require("node:fs");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app } = require("electron");

const run = promisify(execFile);

function findLibreOffice() {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(process.env.ProgramFiles || "C:\\Program Files", "LibreOffice", "program", "soffice.exe"),
          path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "LibreOffice", "program", "soffice.exe"),
        ]
      : process.platform === "darwin"
        ? ["/Applications/LibreOffice.app/Contents/MacOS/soffice"]
        : ["/usr/bin/soffice", "/usr/local/bin/soffice"];
  return candidates.find((p) => existsSync(p)) ?? null;
}

async function hasWord() {
  if (process.platform !== "win32") return false;
  try {
    await run("reg", ["query", "HKCR\\Word.Application"], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/** Retourne { type: "word" } | { type: "libreoffice", path } | null */
async function detectEngine() {
  if (await hasWord()) return { type: "word" };
  const lo = findLibreOffice();
  return lo ? { type: "libreoffice", path: lo } : null;
}

// Script PowerShell exécuté pour piloter Word (chemins passés par variables d'environnement)
const WORD_SCRIPT = `
$ErrorActionPreference = 'Stop'
$before = @(Get-Process WINWORD -ErrorAction SilentlyContinue).Count
$word = New-Object -ComObject Word.Application
try {
  if ($before -eq 0) { $word.DisplayAlerts = 0 }
  $doc = $word.Documents.Open($env:ATT_IN, $false, $true)
  $doc.SaveAs2($env:ATT_OUT, 17)
  $doc.Close(0)
} finally {
  if ($before -eq 0) { $word.Quit() }
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
`;

async function withWord(docx, pdf) {
  const encoded = Buffer.from(WORD_SCRIPT, "utf16le").toString("base64");
  await run(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
    {
      env: { ...process.env, ATT_IN: docx, ATT_OUT: pdf },
      windowsHide: true,
      timeout: 90_000,
    },
  );
}

async function withLibreOffice(soffice, docx, pdf, dir) {
  const profile = pathToFileURL(path.join(app.getPath("userData"), "lo-profile")).href;
  await run(
    soffice,
    [
      "--headless",
      "--norestore",
      "--nolockcheck",
      `-env:UserInstallation=${profile}`,
      "--convert-to",
      "pdf",
      "--outdir",
      dir,
      docx,
    ],
    { timeout: 120_000, windowsHide: true },
  );
  if (!existsSync(pdf)) throw new Error("LibreOffice n'a pas produit de PDF.");
}

// File d'attente : une seule conversion à la fois
let queue = Promise.resolve();
const enqueue = (task) => {
  const p = queue.then(task);
  queue = p.catch(() => {});
  return p;
};

function convertDocxToPdf(docxBuffer) {
  return enqueue(async () => {
    const engine = await detectEngine();
    if (!engine) throw new Error("Aucun moteur de conversion (Word ou LibreOffice) trouvé.");

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "att-"));
    const docx = path.join(dir, "attestation.docx");
    const pdf = path.join(dir, "attestation.pdf");
    try {
      await fs.writeFile(docx, docxBuffer);
      if (engine.type === "word") {
        try {
          await withWord(docx, pdf);
        } catch (err) {
          const lo = findLibreOffice(); // repli si Word échoue
          if (!lo) throw err;
          await withLibreOffice(lo, docx, pdf, dir);
        }
      } else {
        await withLibreOffice(engine.path, docx, pdf, dir);
      }
      return await fs.readFile(pdf);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
}

module.exports = { convertDocxToPdf, detectEngine };