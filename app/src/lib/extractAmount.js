import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url"; // Vite
import { createWorker } from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const AMOUNT_RE = /^\d{1,3}(?:[ .]?\d{3})*[.,]\d{2}$|^\d+[.,]\d{2}$/;
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const toNumber = (s) => Number(s.replace(/\s/g, "").replace(",", "."));

// ---- 1. Mots avec coordonnées (texte natif) ----
async function nativeWords(page) {
  const vp = page.getViewport({ scale: 1 });
  const { items } = await page.getTextContent();
  return items
    .filter((i) => i.str.trim())
    .map((i) => {
      const x0 = i.transform[4];
      const yBottom = vp.height - i.transform[5];
      return { text: i.str.trim(), x0, x1: x0 + i.width, y0: yBottom - i.height, y1: yBottom };
    });
}

// ---- 2. Mots avec coordonnées (OCR) ----
let ocrWorker;
async function ocrWords(page, onProgress) {
  const vp = page.getViewport({ scale: 2.5 });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;

  ocrWorker ??= await createWorker("fra", 1, { logger: onProgress });
  const { data } = await ocrWorker.recognize(canvas);
  return data.words
    .filter((w) => w.text.trim() && w.confidence > 30)
    .map((w) => ({ text: w.text.trim(), x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1 }));
}

// ---- 3. Trouver le montant sous le libellé ----
function findAmount(words, debug = false) {
  const target = ["montant", "total", "des", "factures", "ttc"];
  const n = words.map((w) => norm(w.text));

  // ancre = séquence de mots du libellé
  let anchor = null;
  for (let i = 0; i <= words.length - target.length; i++) {
    if (target.every((t, k) => n[i + k] === t)) {
      anchor = words.slice(i, i + target.length);
      break;
    }
  }
  if (!anchor) return null;

  // 1re ligne du libellé : centrée dans sa cellule → centre x ≈ centre de la colonne
  const lineY1 = Math.max(...anchor.map((w) => w.y1));
  const lineMid = { x: (Math.min(...anchor.map((w) => w.x0)) + Math.max(...anchor.map((w) => w.x1))) / 2 };

  // candidats : nombres sous l'ancre
  const candidates = words
    .filter((w) => AMOUNT_RE.test(w.text) && w.y0 > lineY1)
    .map((w) => ({ ...w, cx: (w.x0 + w.x1) / 2, dy: w.y0 - lineY1, dx: Math.abs((w.x0 + w.x1) / 2 - lineMid.x) }));

  if (debug) console.table(candidates);
  if (!candidates.length) return null;

  // ligne la plus proche sous l'ancre, puis colonne la plus proche en x
  const minDy = Math.min(...candidates.map((c) => c.dy));
  const row = candidates.filter((c) => c.dy - minDy < 20);
  row.sort((a, b) => a.dx - b.dx);
  return { raw: row[0].text, value: toNumber(row[0].text) };
}

// ---- API publique ----
export async function extractAmount(file, { debug = false, onProgress } = {}) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    let words = await nativeWords(page);
    let source = "native";
    if (words.length < 20) {            // page scannée
      words = await ocrWords(page, onProgress);
      source = "ocr";
    }
    if (debug) console.log(`page ${p} (${source})`, words.map((w) => `${w.text} [${Math.round(w.x0)},${Math.round(w.y0)}]`));
    const res = findAmount(words, debug);
    if (res) return { ...res, page: p, source };
  }
  return null;
}