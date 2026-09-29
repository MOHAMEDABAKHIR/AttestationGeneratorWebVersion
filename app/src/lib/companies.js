import * as XLSX from "xlsx";

// Mois de début de l'exercice comptable (1 = janvier)
const FISCAL_START_MONTH = 1;

export const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const FIELDS = [
  ["raison", (h) => h.startsWith("raisonsociale")],
  ["adresse", (h) => h.startsWith("adresse")],
  ["pdg", (h) => h.startsWith("nomdupdg")],
  ["exercice", (h) => h === "exercice"],
  ["trimestre", (h) => h === "trimestre"],
  ["type", (h) => h.startsWith("typed")],
  ["montant", (h) => h.startsWith("montant")],
  ["qualite", (h) => h.startsWith("qualite")],
  ["signataire", (h) => h.startsWith("nomprenom")],
  ["lieu", (h) => h === "lieu"],
  ["date", (h) => h.startsWith("datedesign")],
  ["sexe", (h) => h.startsWith("sexe")], // optionnel
];

const pad = (n) => String(n).padStart(2, "0");
// Date locale -> "AAAA-MM-JJ" (toISOString décalerait d'un jour au Maroc)
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fmtLong = (d) => {
  const mois = d.toLocaleDateString("fr-FR", { month: "long" });
  return `${d.getDate() === 1 ? "1er" : d.getDate()} ${mois} ${d.getFullYear()}`;
};

function getPeriode(exercice, trimestre) {
  const y = parseInt(exercice, 10);
  const q = parseInt(String(trimestre).replace(/\D/g, ""), 10);
  if (!y || !(q >= 1 && q <= 4)) return null;
  const start = new Date(y, FISCAL_START_MONTH - 1 + (q - 1) * 3, 1);
  const end = new Date(y, FISCAL_START_MONTH - 1 + q * 3, 0);
  return {
    debut: toISO(start),
    fin: toISO(end),
    libelle: `Du ${fmtLong(start)} au ${fmtLong(end)}`,
  };
}

const parseMontant = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const sexeFromExcel = (v) => {
  const s = norm(v);
  if (s.startsWith("f")) return "F";
  if (s.startsWith("m") || s.startsWith("h")) return "H";
  return "";
};

// Qualité du signataire + type d'attestation -> nom du template
function getTemplate(qualite, type) {
  const q = norm(qualite);
  const t = norm(type);
  const qualiteSlug = q.startsWith("commissaire")
    ? "Commissaire-aux-comptes"
    : q.startsWith("expert")
      ? "Expert-comptable"
      : null;
  const typeSlug = t.includes("avecretard")
    ? "avec-retard"
    : t.includes("sansretard")
      ? "sans-retard"
      : null;
  return qualiteSlug && typeSlug ? `${qualiteSlug}-${typeSlug}` : null;
}

export function readCompanies(workbook, sheetName) {
  const sheet = workbook?.Sheets?.[sheetName];
  if (!sheet) return [];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
  if (aoa.length < 2) return [];

  const headers = aoa[0].map(norm);
  const idx = {};
  FIELDS.forEach(([key, test]) => {
    const i = headers.findIndex(test);
    if (i !== -1) idx[key] = i;
  });

  return aoa
    .slice(1)
    .map((r, i) => {
      const o = { rowNumber: i + 2 };
      FIELDS.forEach(([key]) => (o[key] = idx[key] !== undefined ? r[idx[key]] ?? "" : ""));
      return o;
    })
    .filter((o) => String(o.raison).trim() !== "");
}

// Ajoute : période, template, erreurs (bloquantes) et avertissements
export function enrichCompany(c, sexeOverride, montantOverride) {
  const montantText = montantOverride ?? (c.montant === "" ? "" : String(c.montant));
  const montant = parseMontant(montantText);
  const t = norm(c.type);
  const avecRetard = t.includes("avecretard");
  const sansRetard = t.includes("sansretard");
  const template = getTemplate(c.qualite, c.type);
  const periode = getPeriode(c.exercice, c.trimestre);
  const sexeValue = sexeOverride ?? sexeFromExcel(c.sexe);

  const errors = [];
  const warnings = [];
  let montantError = false;

  if (avecRetard && !(montant > 0)) {
    montantError = true;
    errors.push("Attestation « Avec retard » : le montant est obligatoire.");
  }
  if (sansRetard && montantText.trim() !== "" && montant !== 0) {
    montantError = true;
    errors.push("Attestation « Sans retard » : le montant doit rester vide.");
  }
  if (!template)
    errors.push("Template introuvable : qualité du signataire ou type d'attestation non reconnu.");
  if (!periode) errors.push("Exercice ou trimestre invalide : période impossible à calculer.");
  if (!sexeValue) warnings.push("Sexe du PDG non renseigné.");

  return { ...c, montantText, montant, avecRetard, template, periode, sexeValue, errors, warnings, montantError };
}

// Objet qui sera écrit dans le JSON
export function toRecord(c) {
  return {
    ligneExcel: c.rowNumber,
    raisonSociale: String(c.raison).trim(),
    adresse: String(c.adresse).trim(),
    pdg: String(c.pdg).trim(),
    sexePdg: c.sexeValue === "F" ? "Femme" : c.sexeValue === "H" ? "Homme" : "",
    civilite: c.sexeValue === "F" ? "Madame" : c.sexeValue === "H" ? "Monsieur" : "",
    exercice: parseInt(c.exercice, 10) || null,
    trimestre: String(c.trimestre).trim(),
    periode: c.periode, // { debut, fin, libelle }
    typeAttestation: String(c.type).trim(),
    montant: c.montant,
    qualiteSignataire: String(c.qualite).trim(),
    signataire: String(c.signataire).trim(),
    lieu: String(c.lieu).trim(),
    dateSignature: c.date instanceof Date ? toISO(c.date) : String(c.date ?? "").trim(),
    template: c.template,
  };
}