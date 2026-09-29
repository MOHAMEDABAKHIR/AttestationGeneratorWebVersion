import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import { slugify } from "./signatureStore";

const MAX_W = 150; // largeur max de la signature dans le Word (px)
const MAX_H = 80;

const dataUrlToBytes = (dataUrl) => {
  const bin = atob(dataUrl.split(",")[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const parseISO = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return { y, m, d };
};
const p2 = (n) => String(n).padStart(2, "0");
const fmtShort = ({ y, m, d }) => `${p2(d)}/${p2(m)}/${y}`;

const fmtMontant = (n) =>
  typeof n === "number"
    ? `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dirhams`
    : "";

// Enregistrement (toRecord) + signature -> données du template Word
function buildData(e, signature) {
  const debut = parseISO(e.periode.debut);
  const fin = parseISO(e.periode.fin);
  const femme = e.civilite === "Madame";
  return {
    raisonSociale: e.raisonSociale,
    civilite: e.civilite,
    pdg: e.pdg,
    titrePdg: femme ? "Gérante" : "Gérant",
    adresse: e.adresse,
    // page de garde : "1er AVRIL AU 30 JUIN 2027"
    jourDebut: String(debut.d),
    exposantDebut: debut.d === 1 ? "er" : "",
    finCouverture: ` ${MOIS[debut.m - 1]} AU ${fin.d} ${MOIS[fin.m - 1]} ${fin.y}`.toUpperCase(),
    // corps : "01/04/2027 au 30/06/2027"
    periodeCourte: `${fmtShort(debut)} au ${fmtShort(fin)}`,
    montant: fmtMontant(e.montant),
    lieu: e.lieu,
    dateSignature: e.dateSignature ? fmtShort(parseISO(e.dateSignature)) : "",
    signataire: e.signataire,
    signature: {
      bytes: dataUrlToBytes(signature.dataUrl),
      ...(() => {
        const r = Math.min(MAX_W / signature.width, MAX_H / signature.height);
        return { w: Math.round(signature.width * r), h: Math.round(signature.height * r) };
      })(),
    },
  };
}

const templateCache = new Map();
async function loadTemplate(name) {
  if (!templateCache.has(name)) {
    const res = await fetch(`${import.meta.env.BASE_URL}templates/${name}.docx`);
    if (!res.ok) throw new Error(`Template introuvable : ${name}.docx`);
    templateCache.set(name, await res.arrayBuffer());
  }
  return templateCache.get(name);
}

export async function generateDocx(e, signature) {
  const buffer = await loadTemplate(e.template);
  let zip;
  try {
    zip = new PizZip(buffer);
  } catch {
    throw new Error(`Template invalide ou absent : ${e.template}.docx (dans public/templates)`);
  }
  const imageModule = new ImageModule({
    centered: false,
    getImage: (tag) => tag.bytes,
    getSize: (_img, tag) => [tag.w, tag.h],
  });
  const doc = new Docxtemplater(zip, { modules: [imageModule], paragraphLoop: true, linebreaks: true });
  await doc.renderAsync(buildData(e, signature));
  return doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });
}

export const attestationFileName = (e) =>
  `Attestation_${slugify(e.raisonSociale)}_${e.exercice}-${slugify(e.trimestre)}.docx`;

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Génère un .docx par entreprise (un seul -> .docx, plusieurs -> .zip)
export async function generateAll(entreprises, getSignature) {
  const files = [];
  const errors = [];
  for (const e of entreprises) {
    try {
      files.push({ name: attestationFileName(e), blob: await generateDocx(e, getSignature(e)) });
    } catch (err) {
      errors.push(`${e.raisonSociale} : ${err.message}`);
    }
  }
  if (files.length === 1) {
    downloadBlob(files[0].blob, files[0].name);
  } else if (files.length > 1) {
    const zip = new PizZip();
    for (const f of files) zip.file(f.name, await f.blob.arrayBuffer());
    downloadBlob(zip.generate({ type: "blob" }), "Attestations.zip");
  }
  return { count: files.length, errors };
}