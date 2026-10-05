// src/lib/cabinetStore.js
// Configuration cabinet : clients + signataires + signatures
// Clé localStorage : "cabinet:mLExpertsAudit&Conseil"

import { signatureKey as legacySignatureKey, slugify } from "./signatureStore";

const KEY = "cabinet:mLExpertsAudit&Conseil";
const VERSION = 1;

/* ------------------------------------------------------------------ */
/*  Utilitaires                                                        */
/* ------------------------------------------------------------------ */

export const normRaison = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const uuid = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const emptyConfig = () => ({
  version: VERSION,
  signataires: [],
  clients: [],
});

/* ------------------------------------------------------------------ */
/*  Migration depuis l'ancien signatureStore                           */
/* ------------------------------------------------------------------ */

// Ancien format : localStorage["signature:mehdi-lahlou-expert-comptable"]
// { dataUrl, width, height }
// On ne peut PAS deviner le nom/qualité proprement depuis la clé.
// Stratégie : on scanne toutes les clés "signature:*" et on tente de
// reconstruire un signataire via les valeurs connues (SIGNATAIRES/QUALITES
// historiques). Si on ne sait pas, on ignore (l'utilisateur recréera).

const LEGACY_SIGNATAIRES = ["Mehdi LAHLOU", "Mohamed Ali"];
const LEGACY_QUALITES = ["Expert-comptable", "Commissaire aux comptes"];

function migrateFromLegacy() {
  const signataires = [];
  for (const nom of LEGACY_SIGNATAIRES) {
    for (const qualite of LEGACY_QUALITES) {
      const key = legacySignatureKey(nom, qualite);
      let sig = null;
      try {
        sig = JSON.parse(localStorage.getItem(key));
      } catch {
        /* ignore */
      }
      if (sig?.dataUrl) {
        signataires.push({
          id: uuid(),
          nom,
          qualite,
          signature: sig,
        });
      }
    }
  }
  return signataires;
}

/* ------------------------------------------------------------------ */
/*  Chargement / sauvegarde                                            */
/* ------------------------------------------------------------------ */

export function loadCabinet() {
  let cfg = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) cfg = JSON.parse(raw);
  } catch {
    cfg = null;
  }

  if (!cfg || cfg.version !== VERSION) {
    // Première fois : tenter la migration depuis l'ancien store
    const migrated = migrateFromLegacy();
    cfg = { ...emptyConfig(), signataires: migrated };
    saveCabinet(cfg);
  }

  // Garantir la forme
  cfg.signataires ??= [];
  cfg.clients ??= [];
  return cfg;
}

export function saveCabinet(cfg) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
    return true;
  } catch (e) {
    console.error("Sauvegarde cabinet impossible :", e);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Signataires                                                        */
/* ------------------------------------------------------------------ */

export function upsertSignataire(signataire) {
  const cfg = loadCabinet();
  const s = { ...signataire };
  if (!s.id) s.id = uuid();
  const i = cfg.signataires.findIndex((x) => x.id === s.id);
  if (i === -1) cfg.signataires.push(s);
  else cfg.signataires[i] = { ...cfg.signataires[i], ...s };
  saveCabinet(cfg);
  return s;
}

export function deleteSignataire(id) {
  const cfg = loadCabinet();
  cfg.signataires = cfg.signataires.filter((s) => s.id !== id);
  // Détacher les clients qui pointaient vers lui
  cfg.clients = cfg.clients.map((c) =>
    c.signataireId === id ? { ...c, signataireId: "" } : c,
  );
  saveCabinet(cfg);
}

export function getSignataire(id) {
  if (!id) return null;
  return loadCabinet().signataires.find((s) => s.id === id) ?? null;
}

/* ------------------------------------------------------------------ */
/*  Clients                                                            */
/* ------------------------------------------------------------------ */

export function upsertClient(client) {
  const cfg = loadCabinet();
  const c = { ...client };
  if (!c.id) c.id = uuid();
  const i = cfg.clients.findIndex((x) => x.id === c.id);
  if (i === -1) cfg.clients.push(c);
  else cfg.clients[i] = { ...cfg.clients[i], ...c };
  saveCabinet(cfg);
  return c;
}

export function deleteClient(id) {
  const cfg = loadCabinet();
  cfg.clients = cfg.clients.filter((c) => c.id !== id);
  saveCabinet(cfg);
}

export function findClientByRaison(raison) {
  const target = normRaison(raison);
  if (!target) return null;
  const cfg = loadCabinet();
  // Match exact normalisé d'abord
  let hit = cfg.clients.find((c) => normRaison(c.raisonSociale) === target);
  if (hit) return hit;
  // Sinon : inclusion (l'un contient l'autre, min 4 caractères)
  if (target.length >= 4) {
    hit = cfg.clients.find((c) => {
      const n = normRaison(c.raisonSociale);
      return n.length >= 4 && (n.includes(target) || target.includes(n));
    });
  }
  return hit ?? null;
}

/* ------------------------------------------------------------------ */
/*  Export / Import JSON                                               */
/* ------------------------------------------------------------------ */

export function exportCabinetJSON() {
  const cfg = loadCabinet();
  const blob = new Blob([JSON.stringify(cfg, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cabinet_mLExpertsAuditConseil_${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importCabinetJSON(file) {
  const text = await file.text();
  const cfg = JSON.parse(text);
  if (!cfg || !Array.isArray(cfg.signataires) || !Array.isArray(cfg.clients)) {
    throw new Error("Fichier de configuration invalide.");
  }
  cfg.version = VERSION;
  saveCabinet(cfg);
  return cfg;
}

/* ------------------------------------------------------------------ */
/*  Helpers UI                                                         */
/* ------------------------------------------------------------------ */

// Renvoie { client, signataire } pour une raison donnée, ou null
export function resolveClient(raison) {
  const client = findClientByRaison(raison);
  if (!client) return null;
  const signataire = client.signataireId
    ? getSignataire(client.signataireId)
    : null;
  return { client, signataire };
}

// Utilisé par la génération Word : renvoie la signature d'un signataire
export function getSignatureFor(signataireNom, signataireQualite) {
  const cfg = loadCabinet();
  const n = slugify(signataireNom);
  const q = slugify(signataireQualite);
  const s = cfg.signataires.find(
    (x) => slugify(x.nom) === n && slugify(x.qualite) === q,
  );
  return s?.signature ?? null;
}

export { uuid as newId };