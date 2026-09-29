// Signatures stockées dans localStorage sous la clé "signature:<nom>-<qualité>"
// ex. "signature:mehdi-lahlou-expert-comptable"
const slug = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const signatureKey = (signataire, qualite) =>
  `signature:${slug(signataire)}-${slug(qualite)}`;

export const slugify = slug;

export function loadSignature(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? null; // { dataUrl, width, height }
  } catch {
    return null;
  }
}

export function saveSignature(key, sig) {
  try {
    localStorage.setItem(key, JSON.stringify(sig));
    return true;
  } catch (e) {
    console.error("Sauvegarde de la signature impossible :", e);
    return false;
  }
}

export function deleteSignature(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* rien */
  }
}

// Fichier image -> PNG réduit (largeur max 500 px) pour rester léger dans localStorage
export function fileToSignature(file, maxWidth = 500) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxWidth / img.naturalWidth);
      const width = Math.round(img.naturalWidth * ratio);
      const height = Math.round(img.naturalHeight * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL("image/png"), width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible"));
    };
    img.src = url;
  });
}