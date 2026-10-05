// src/lib/geminiClient.js
// Envoi du PDF à Gemini avec liste de modèles, timeout et basculement automatique.

const API = "https://generativelanguage.googleapis.com";

// Ordre de préférence. Surchargeable dans .env :
//VITE_GEMINI_MODELS =gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.0-flash
const DEFAULT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest", // alias : dernier filet de sécurité
];

const fromEnv = (import.meta.env.VITE_GEMINI_MODELS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const MODELS = fromEnv.length ? fromEnv : DEFAULT_MODELS;

const TIMEOUT_MS = 45_000; // par tentative
const MAX_INLINE_BYTES = 15 * 1024 * 1024; // au-delà : Files API

const PROMPT = `Tu es un extracteur de données de déclarations fiscales marocaines (DGI), en français et arabe.

À partir du PDF fourni (texte natif ou scan), retourne UNIQUEMENT un objet JSON :
{
  "raisonSociale": string | null,
  "adresse": string | null,
  "montantNonPayeTTC": number | null
}

Règles :
- "raisonSociale" : valeur de "Nom et prénom ou raison sociale" (section IDENTITE DU DECLARANT).
- "adresse" : valeur de "Adresse du siège social, du principal établissement ou du domicile fiscal".
- "montantNonPayeTTC" : nombre figurant sur la ligne "Montant total des factures TTC non payées dans les délais" (section FACTURES NON PAYEES DANS LES DELAIS). Nombre pur, sans espace ni devise, point comme séparateur décimal. Si la ligne est absente ou vide : 0.
- Ne traduis rien, ne reformule rien, garde les valeurs telles quelles.
- Si un champ texte est introuvable : null.
- Aucun champ supplémentaire.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    raisonSociale: { type: "STRING", nullable: true },
    adresse: { type: "STRING", nullable: true },
    montantNonPayeTTC: { type: "NUMBER", nullable: true },
  },
  required: ["raisonSociale", "adresse", "montantNonPayeTTC"],
};

/* ------------------------------------------------------------------ */

class GeminiError extends Error {
  constructor(message, { status = 0, fatal = false } = {}) {
    super(message);
    this.status = status;
    this.fatal = fatal; // true = inutile d'essayer un autre modèle
  }
}

async function fetchWithTimeout(url, options, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (e) {
    if (e.name === "AbortError")
      throw new GeminiError(`Timeout (${ms / 1000}s)`, { status: 408 });
    throw new GeminiError(`Erreur réseau : ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Gros PDF : upload via la Files API, retourne la part "fileData". */
async function uploadPDF(file, apiKey) {
  const start = await fetchWithTimeout(`${API}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(file.size),
      "X-Goog-Upload-Header-Content-Type": "application/pdf",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: file.name } }),
  });
  if (!start.ok) {
    throw new GeminiError(`Upload start ${start.status}`, {
      status: start.status,
      fatal: start.status === 401 || start.status === 403,
    });
  }
  const uploadUrl = start.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) throw new GeminiError("URL d'upload manquante", { fatal: true });

  const up = await fetchWithTimeout(
    uploadUrl,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: file,
    },
    120_000,
  );
  if (!up.ok) throw new GeminiError(`Upload contenu ${up.status}`, { status: up.status });

  const info = await up.json();
  if (!info?.file?.uri) throw new GeminiError("URI du fichier manquante", { fatal: true });
  return { fileData: { fileUri: info.file.uri, mimeType: "application/pdf" } };
}

async function buildPdfPart(file, apiKey) {
  if (file.size <= MAX_INLINE_BYTES) {
    return {
      inlineData: { mimeType: "application/pdf", data: await fileToBase64(file) },
    };
  }
  return uploadPDF(file, apiKey);
}

/* ------------------------------------------------------------------ */

function toNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastC = s.lastIndexOf(",");
  const lastD = s.lastIndexOf(".");
  if (lastC > -1 && lastD > -1) {
    const dec = lastC > lastD ? "," : ".";
    const thousands = dec === "," ? /\./g : /,/g;
    s = s.replace(thousands, "").replace(dec, ".");
  } else if (lastC > -1) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseResult(text) {
  const cleaned = String(text || "")
    .replace(/```json|```/gi, "")
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new GeminiError("Réponse sans JSON");

  let obj;
  try {
    obj = JSON.parse(match[0]);
  } catch {
    throw new GeminiError("JSON invalide");
  }

  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const result = {
    raisonSociale: str(obj.raisonSociale),
    adresse: str(obj.adresse),
    montantNonPayeTTC: toNumber(obj.montantNonPayeTTC),
  };

  // Réponse vide = échec → on essaiera le modèle suivant
  if (!result.raisonSociale && !result.adresse) {
    throw new GeminiError("Aucun champ trouvé dans la réponse");
  }
  return result;
}

async function callModel(model, pdfPart, apiKey) {
  const res = await fetchWithTimeout(`${API}/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [pdfPart, { text: PROMPT }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const badKey =
      res.status === 401 ||
      res.status === 403 ||
      (res.status === 400 && /api key/i.test(body));
    throw new GeminiError(`HTTP ${res.status} : ${body.slice(0, 180)}`, {
      status: res.status,
      fatal: badKey,
    });
  }

  const data = await res.json();
  const block = data?.promptFeedback?.blockReason;
  if (block) throw new GeminiError(`Requête bloquée (${block})`);

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return parseResult(text);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */

/**
 * Extrait raisonSociale / adresse / montantNonPayeTTC depuis un PDF.
 * Essaie chaque modèle de MODELS dans l'ordre jusqu'au premier succès.
 */
export async function extractDeclarationWithGemini(file, { onStep } = {}) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VITE_GEMINI_API_KEY manquante. Ajoute-la dans .env puis REDÉMARRE Vite.",
    );
  }

  onStep?.("Préparation du PDF…");
  const pdfPart = await buildPdfPart(file, apiKey);

  const attempts = [];

  for (const model of MODELS) {
    // 2 essais max par modèle, uniquement pour les erreurs serveur temporaires
    for (let attempt = 1; attempt <= 2; attempt++) {
      onStep?.(`Analyse IA (${model})…`);
      try {
        const result = await callModel(model, pdfPart, apiKey);
        return { ...result, source: "gemini", model, attempts };
      } catch (e) {
        const err = e instanceof GeminiError ? e : new GeminiError(e.message);
        attempts.push({ model, attempt, status: err.status, error: err.message });
        console.warn(`[Gemini] ${model} (essai ${attempt}) :`, err.message);

        if (err.fatal) {
          throw new Error(`Clé API refusée : ${err.message}`);
        }
        const transient = err.status === 500 || err.status === 503;
        if (transient && attempt === 1) {
          await sleep(1500);
          continue; // 2e essai sur le même modèle
        }
        break; // 404, 429, 408 (timeout), 400, JSON vide… → modèle suivant
      }
    }
  }

  const detail = attempts.map((a) => `${a.model}: ${a.error}`).join(" | ");
  throw new Error(`Tous les modèles ont échoué. ${detail}`.slice(0, 600));
}