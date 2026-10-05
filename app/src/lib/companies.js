import * as XLSX from "xlsx";

const FISCAL_START_MONTH = 1;

export const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // accents
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width + BOM
    .replace(/[\u00A0\u202F]/g, " ")   // espaces insécables → espace normal
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");        // enlève tout sauf a-z0-9

const FIELDS = [
  ["raison", (h) => h.startsWith("raisonsociale")],
  ["adresse", (h) => h.startsWith("adresse")],
  [
    "representant",
    (h) =>
      h.startsWith("nomdurepresentant") ||
      h.startsWith("nomrepresentant") ||
      h.startsWith("nomdupdg") ||
      h.startsWith("representant"),
  ],
  [
    "civiliteRepresentant",
    (h) =>
      // Tolérant : "Civilité du représentant", "Civilite representant", etc.
      h.includes("civilite") && h.includes("representant"),
  ],
  // ⚠️ DOIT être AVANT "qualite"
  [
    "qualiteRepresentant",
    (h) =>
      (h.includes("qualite") && h.includes("representant")) ||
      (h.includes("qualite") && h.includes("pdg")),
  ],
  ["exercice", (h) => h === "exercice"],
  ["trimestre", (h) => h === "trimestre"],
  ["type", (h) => h.startsWith("typed")],
  ["montant", (h) => h.startsWith("montant")],
  // ⚠️ EXCLUT explicitement qualiteRepresentant
  [
    "qualite",
    (h) =>
      h.startsWith("qualite") &&
      !h.includes("representant") &&
      !h.includes("pdg"),
  ],
  ["signataire", (h) => h.startsWith("nomprenom")],
  ["lieu", (h) => h === "lieu"],
  ["date", (h) => h.startsWith("datedesign")],
  ["sexe", (h) => h.startsWith("sexe")],
];

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fmtLong = (d) => {
  const mois = d.toLocaleDateString("fr-FR", { month: "long" });
  return `${d.getDate() === 1 ? "1er" : d.getDate()} ${mois} ${d.getFullYear()}`;
};

// ---------------------------------------------------------------
// 📅 NOUVELLE RÈGLE : la date de signature détermine Exercice + Trimestre
//    Avril  -> T1, année en cours
//    Juillet -> T2, année en cours
//    Octobre -> T3, année en cours
//    Décembre -> T4, année en cours
//    Janvier -> T4, année précédente
// ---------------------------------------------------------------
export const MOIS_VALIDES = [1, 4, 7, 10]; // janv, avril, juillet, oct

export function periodeFromDate(dateInput) {
  const d =
    dateInput instanceof Date ? dateInput : new Date(String(dateInput));
  if (!d || Number.isNaN(d.getTime())) {
    return { ok: false, raison: "Date de signature invalide ou manquante." };
  }

  const mois = d.getMonth() + 1; // 1..12
  const annee = d.getFullYear();

  let trimestre;
  let exercice;

  switch (mois) {
    case 4: // Avril
      trimestre = 1;
      exercice = annee;
      break;
    case 7: // Juillet
      trimestre = 2;
      exercice = annee;
      break;
    case 10: // Octobre
      trimestre = 3;
      exercice = annee;
      break;
    case 1: // Janvier -> T4 de l'année précédente
      trimestre = 4;
      exercice = annee - 1;
      break;
    default:
      return {
        ok: false,
        raison:
          "La date de signature doit être en janvier, avril, juillet ou octobre.",
      };
  }

  return { ok: true, exercice, trimestre };
}

// Construit la période à partir de (exercice, trimestre)
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
  const n =
    typeof v === "number"
      ? v
      : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const sexeFromExcel = (v) => {
  const s = norm(v);
  if (s.startsWith("f")) return "F";
  if (s.startsWith("m") || s.startsWith("h")) return "H";
  return "";
};

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
  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  if (aoa.length < 2) return [];

  const headers = aoa[0].map(norm);
  console.log("[DEBUG] Headers normalisés :", headers);
  console.log("[DEBUG] Index de qualiteRepresentant :",
    headers.findIndex((h) =>
      (h.includes("qualite") && h.includes("representant")) ||
      (h.includes("qualite") && h.includes("pdg"))
    )
  );
  console.log("[DEBUG] Valeur ligne 2 :", aoa[1]);
  const idx = {};
  FIELDS.forEach(([key, test]) => {
    const i = headers.findIndex(test);
    if (i !== -1) idx[key] = i;
  });

  return aoa
    .slice(1)
    .map((r, i) => {
      const o = { rowNumber: i + 2 };
      FIELDS.forEach(
        ([key]) => (o[key] = idx[key] !== undefined ? r[idx[key]] ?? "" : ""),
      );
      return o;
    })
    .filter((o) => String(o.raison).trim() !== "");
}

// ---------------------------------------------------------------
// enrichCompany : calcule désormais Exercice + Trimestre
// depuis la date de signature (les valeurs Excel sont ignorées)
// ---------------------------------------------------------------
export function enrichCompany(c, sexeOverride, montantOverride, dateOverride) {
  const montantText =
    montantOverride ?? (c.montant === "" ? "" : String(c.montant));
  const montant = parseMontant(montantText);
  const t = norm(c.type);
  const avecRetard = t.includes("avecretard");
  const sansRetard = t.includes("sansretard");
  const template = getTemplate(c.qualite, c.type);
  const sexeValue =
  sexeOverride ??
  sexeFromExcel(c.civiliteRepresentant) ??
  sexeFromExcel(c.sexe);

  const civilite =
    sexeValue === "F" ? "Madame" : sexeValue === "H" ? "Monsieur" : "";
  const titreRepresentant = String(c.qualiteRepresentant ?? "").trim();

  // 📅 Date de signature effective (override depuis la modale, sinon valeur Excel)
  const dateEffective = dateOverride ?? c.date ?? "";
  const dateObj = dateEffective
    ? dateEffective instanceof Date
      ? dateEffective
      : new Date(String(dateEffective))
    : null;

  // Calcul auto Exercice + Trimestre
  const calcul = dateObj ? periodeFromDate(dateObj) : { ok: false, raison: "Date de signature manquante." };
  const exercice = calcul.ok ? calcul.exercice : "";
  const trimestre = calcul.ok ? calcul.trimestre : "";
  const periode = calcul.ok ? getPeriode(exercice, trimestre) : null;

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
    errors.push(
      "Template introuvable : qualité du signataire ou type d'attestation non reconnu.",
    );
  if (!calcul.ok) errors.push(calcul.raison);
  if (!sexeValue) warnings.push("Civilité du représentant non renseignée.");
  if (!titreRepresentant)
    warnings.push("Qualité du représentant non renseignée.");

  return {
    ...c,
    montantText,
    montant,
    avecRetard,
    template,
    periode,
    exercice,
    trimestre,
    dateEffective,
    sexeValue,
    civilite,
    titreRepresentant,
    errors,
    warnings,
    montantError,
  };
}

export function toRecord(c) {
  return {
    ligneExcel: c.rowNumber,
    raisonSociale: String(c.raison).trim(),
    adresse: String(c.adresse).trim(),
    representant: String(c.representant).trim(),
    sexeRepresentant:
      c.sexeValue === "F" ? "Femme" : c.sexeValue === "H" ? "Homme" : "",
    civiliteExcel: String(c.civiliteRepresentant ?? "").trim(),
    civilite: c.civilite,
    qualiteRepresentant: String(c.qualiteRepresentant ?? "").trim(),
    exercice: c.exercice || null,
    trimestre: String(c.trimestre ?? ""),
    periode: c.periode,
    typeAttestation: String(c.type).trim(),
    montant: c.montant,
    qualiteSignataire: String(c.qualite).trim(),
    signataire: String(c.signataire).trim(),
    lieu: String(c.lieu).trim(),
    dateSignature: (() => {
      const d = c.dateEffective;
      if (!d) return "";
      const dd = d instanceof Date ? d : new Date(String(d));
      if (Number.isNaN(dd.getTime())) return String(d);
      return toISO(dd);
    })(),
    template: c.template,
  };
}