
import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { createWorker } from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// Fonction utilitaire : reçoit un canvas et retourne un canvas amélioré
function ameliorerImage(sourceCanvas) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  ctx.drawImage(sourceCanvas, 0, 0);

  const image = ctx.getImageData(
    0, 0, canvas.width, canvas.height
  );

  const pixels = image.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const gray =
      0.299 * pixels[i] +
      0.587 * pixels[i + 1] +
      0.114 * pixels[i + 2];

    const enhanced = Math.max(
      0,
      Math.min(255, (gray - 128) * 1.35 + 128)
    );

    pixels[i] = enhanced;
    pixels[i + 1] = enhanced;
    pixels[i + 2] = enhanced;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

export default function AmountExtractorPage() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Veuillez sélectionner un PDF.");
      return;
    }

    setLoading(true);
    setError("");
    setPages([]);

    let worker;

    try {
      const buffer = await file.arrayBuffer();

      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
      }).promise;

      worker = await createWorker("fra+ara", 1, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setProgress(
              `OCR : ${Math.round(message.progress * 100)} %`
            );
          }
        },
      });

      await worker.setParameters({
        tessedit_pageseg_mode: "6",
        preserve_interword_spaces: "1",
      });

      const results = [];

      for (let n = 1; n <= pdf.numPages; n++) {
        setProgress(`Analyse de la page ${n}/${pdf.numPages}...`);

        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale: 3 });

        const original = document.createElement("canvas");
        original.width = Math.ceil(viewport.width);
        original.height = Math.ceil(viewport.height);

        const ctx = original.getContext("2d");

        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;

        const enhanced = ameliorerImage(original);

        const first = await worker.recognize(original);
        const second = await worker.recognize(enhanced);

        const best =
          second.data.confidence > first.data.confidence
            ? second.data
            : first.data;

        results.push({
          pageNumber: n,
          text: best.text.trim(),
          confidence: Math.round(best.confidence),
          needsReview: best.confidence < 75,
        });

        setPages([...results]);

        original.width = 0;
        original.height = 0;
        enhanced.width = 0;
        enhanced.height = 0;
      }

      setProgress("Analyse terminée.");
    } catch (err) {
      console.error(err);
      setError("Impossible d'analyser le PDF.");
    } finally {
      if (worker) await worker.terminate();
      setLoading(false);
    }
  }

  return (
    <main className="ocr-container">
      <h1>Extraction de texte PDF</h1>

      <input
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFile}
        disabled={loading}
      />

      {loading && <p>{progress}</p>}
      {error && <p className="ocr-warning">{error}</p>}

      {pages.map((page) => (
        <section key={page.pageNumber} className="ocr-page">
          <h2>Page {page.pageNumber}</h2>

          <p>
            Confiance : {page.confidence} %
            {page.needsReview && " — Vérification recommandée"}
          </p>

          <textarea
            value={page.text}
            readOnly
            rows={12}
            placeholder="Aucun texte détecté."
          />

          <button
            type="button"
            onClick={() =>
              navigator.clipboard.writeText(page.text)
            }
          >
            Copier le texte
          </button>
        </section>
      ))}
    </main>
  );
}