// src/lib/extractDeclaration.js
import { extractDeclarationWithGemini } from "./geminiClient";

export async function extractDeclaration(file, { onStep } = {}) {
  return extractDeclarationWithGemini(file, { onStep });
}