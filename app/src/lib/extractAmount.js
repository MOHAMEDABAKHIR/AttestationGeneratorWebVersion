import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// L'anchor FR fiable (ASCII, stable)
const ANCHOR = 'Montant total des factures TTC non';

/**
 * Normalise le texte : enlève accents, espaces multiples, met en minuscule.
 * On garde l'arabe tel quel, mais on ne s'en sert pas comme anchor.
 */
function norm(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cherche le montant juste SOUS l'anchor.
 */
export async function extractAmount(file, { debug = false } = {}) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const results = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    // 1. Récupère les runs avec position
    const items = content.items
      .filter(it => it.str && it.str.trim() !== '')
      .map(it => ({
        text: it.str,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width,
        h: it.height || Math.abs(it.transform[3]) || 10,
      }));

    if (items.length === 0) continue;

    // 2. Trouver le run qui contient l'anchor (ou une partie)
    //    On regroupe d'abord par ligne (Y proche), puis on cherche l'anchor
    const Y_TOL = 3;
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const lines = [];
    for (const it of items) {
      let line = lines.find(l => Math.abs(l.y - it.y) < Y_TOL);
      if (!line) { line = { y: it.y, items: [] }; lines.push(line); }
      line.items.push(it);
    }
    lines.sort((a, b) => b.y - a.y);
    lines.forEach(l => l.items.sort((a, b) => a.x - b.x));

    // 3. Trouve la ligne de l'anchor
    let anchorLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i].items.map(it => it.text).join(' ');
      if (norm(lineText).includes(norm(ANCHOR))) {
        anchorLineIdx = i;
        break;
      }
    }

    if (anchorLineIdx === -1) continue;

    // 4. Cherche dans les lignes suivantes celle qui contient un montant
    const AMOUNT_RE = /(\d[\d\s.,]*\d|\d)/g;
    for (let i = anchorLineIdx + 1; i < Math.min(lines.length, anchorLineIdx + 6); i++) {
      const lineText = lines[i].items.map(it => it.text).join(' ');
      const matches = lineText.match(AMOUNT_RE);
      if (matches) {
        // Prend le plus long match (le montant, pas un numéro de page)
        const best = matches
          .map(m => m.trim())
          .sort((a, b) => b.length - a.length)[0];
        if (best && best.replace(/\D/g, '').length >= 3) {
          results.push({ page: p, amount: best, context: lineText.trim() });
          break;
        }
      }
    }

    if (debug) {
      console.log(`--- Page ${p} ---`);
      lines.forEach((l, i) => {
        const t = l.items.map(it => it.text).join(' ');
        console.log(i === anchorLineIdx ? `>> ${t}` : `   ${t}`);
      });
    }
  }

  return {
    found: results.length > 0,
    results,
    // pratique : le premier résultat
    amount: results[0]?.amount ?? null,
  };
}