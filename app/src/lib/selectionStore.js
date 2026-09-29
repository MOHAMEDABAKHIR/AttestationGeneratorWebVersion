const KEY = "attestations:selection";

export function saveSelection(data) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Sauvegarde de la sélection impossible :", e);
  }
}

export function loadSelection() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) ?? null;
  } catch {
    return null;
  }
}

export function clearSelection() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* rien */
  }
}