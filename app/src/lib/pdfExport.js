import { PDFDocument } from "pdf-lib";

/** Convertit un Blob .docx en Blob PDF via l'app de bureau (Word ou LibreOffice). */
export async function docxBlobToPdfBlob(docxBlob) {
  if (!window.desktop) {
    throw new Error(
      "L'export PDF n'est disponible que dans l'application de bureau.",
    );
  }
  try {
    const bytes = new Uint8Array(await docxBlob.arrayBuffer());
    const pdfBytes = await window.desktop.docxToPdf(bytes);
    return new Blob([pdfBytes], { type: "application/pdf" });
  } catch (err) {
    // Electron préfixe les erreurs : on garde seulement le message utile
    const msg = String(err?.message ?? err).replace(
      /^Error invoking remote method '[^']+': (Error: )?/,
      "",
    );
    throw new Error(msg);
  }
}

/** Fusionne plusieurs PDF dans l'ordre donné. */
export async function mergePdfBlobs(blobs) {
  const merged = await PDFDocument.create();
  for (const blob of blobs) {
    if (!blob) continue;
    const doc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()), {
      ignoreEncryption: true,
    });
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return new Blob([await merged.save()], { type: "application/pdf" });
}