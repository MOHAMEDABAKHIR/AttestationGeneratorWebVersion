// src/lib/pdfExport.js
import { renderAsync } from "docx-preview";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { PDFDocument } from "pdf-lib";

/**
 * Convertit un Blob .docx en Blob PDF (rendu fidèle, images incluses).
 * La docx est rendue hors écran par docx-preview, puis chaque page
 * <section.docx> est capturée avec html2canvas et posée sur une page A4.
 */
export async function docxBlobToPdfBlob(docxBlob) {
  // Conteneur hors écran (largeur A4 à 96 dpi)
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: 794px;
    background: #ffffff;
    z-index: -1;
  `;
  document.body.appendChild(container);

  try {
    const arrayBuffer = await docxBlob.arrayBuffer();

    await renderAsync(arrayBuffer, container, container, {
      className: "docx",
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      experimental: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      useBase64URL: true,
    });

    // Laisse le temps aux images (signatures) et polices de se charger
    try {
      if (document.fonts?.ready) await document.fonts.ready;
    } catch {
      /* noop */
    }
    await new Promise((r) => setTimeout(r, 400));

    const sections = container.querySelectorAll("section.docx");
    if (!sections.length) {
      throw new Error("Rendu Word introuvable (template vide ou invalide).");
    }

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      const canvas = await html2canvas(section, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const ratio = canvas.width / canvas.height; // w / h

      let imgW = pageW;
      let imgH = pageW / ratio;
      if (imgH > pageH) {
        imgH = pageH;
        imgW = pageH * ratio;
      }

      if (i > 0) pdf.addPage();
      pdf.addImage(
        imgData,
        "JPEG",
        (pageW - imgW) / 2,
        0,
        imgW,
        imgH,
        undefined,
        "FAST"
      );
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Fusionne plusieurs Blobs PDF en un seul.
 * L'ordre est respecté : [attestation, declaration].
 */
export async function mergePdfBlobs(blobs) {
  const merged = await PDFDocument.create();

  for (const blob of blobs) {
    if (!blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }

  const out = await merged.save();
  // On renvoie un Blob compatible avec ton downloadBlob existant
  return new Blob([out], { type: "application/pdf" });
}