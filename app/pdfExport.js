
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(
  __dirname,
  "Expert-comptable-sans-retard.docx"
);

const outputDir = __dirname;
const outputPath = path.join(outputDir, "test.pdf");

const sofficePath =
  "/Applications/LibreOffice.app/Contents/MacOS/soffice";

async function exportToPdf() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Document Word introuvable : ${inputPath}`);
  }

  if (!fs.existsSync(sofficePath)) {
    throw new Error(
      "LibreOffice est introuvable. Vérifie son installation."
    );
  }

  // Profil temporaire isolé pour éviter les conflits de processus.
  const profilePath = path.join(
    __dirname,
    ".libreoffice-profile"
  );

  const profileUrl = `file://${profilePath
    .split("/")
    .map((part, index) =>
      index === 0 ? "" : encodeURIComponent(part)
    )
    .join("/")}`;

  // Supprimer l'ancien PDF pour éviter toute confusion.
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  await execFileAsync(sofficePath, [
    `-env:UserInstallation=${profileUrl}`,
    "--headless",
    "--convert-to",
    "pdf:writer_pdf_Export",
    "--outdir",
    outputDir,
    inputPath,
  ]);

  if (!fs.existsSync(outputPath)) {
    throw new Error("LibreOffice n'a pas généré le PDF attendu.");
  }

  const stats = fs.statSync(outputPath);

  if (stats.size === 0) {
    throw new Error("Le PDF généré est vide.");
  }

  console.log("PDF généré avec succès :", outputPath);
  console.log("Taille :", stats.size, "octets");
}

exportToPdf().catch((error) => {
  console.error("Erreur lors de la conversion :", error.message);
  process.exitCode = 1;
});
