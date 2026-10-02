import { useState } from 'react';
import { extractAmount } from '../lib/extractAmount';

export default function PdfTestPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [debug, setDebug] = useState(false);

  const onFile = async (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const res = await extractAmount(f, { debug });
      setResult(res);
    } catch (e) {
      console.error(e);
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1>Extracteur de montant PDF</h1>

      <input
        type="file"
        accept="application/pdf"
        onChange={e => onFile(e.target.files?.[0])}
      />

      <label style={{ display: 'block', marginTop: 12 }}>
        <input
          type="checkbox"
          checked={debug}
          onChange={e => setDebug(e.target.checked)}
        />{' '}
        Mode debug (log les lignes dans la console)
      </label>

      {file && (
        <p style={{ color: '#666' }}>
          Fichier : <b>{file.name}</b> ({(file.size / 1024).toFixed(1)} KB)
        </p>
      )}

      {loading && <p>⏳ Lecture du PDF…</p>}
      {error && <p style={{ color: 'crimson' }}>❌ {error}</p>}

      {result && (
        <div style={{ marginTop: 20, padding: 16, background: '#f6f6f6', borderRadius: 8 }}>
          {result.found ? (
            <>
              <div style={{ fontSize: 14, color: '#666' }}>Montant détecté :</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#0a7' }}>
                {result.amount}
              </div>
              <details style={{ marginTop: 12 }}>
                <summary>Détails ({result.results.length} occurrence(s))</summary>
                <ul>
                  {result.results.map((r, i) => (
                    <li key={i}>
                      page {r.page} — <b>{r.amount}</b>
                      <br />
                      <small style={{ color: '#888' }}>{r.context}</small>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            <p style={{ color: 'orange' }}>
              ⚠️ Anchor non trouvé. Coche <b>mode debug</b> et regarde la console :
              tu verras les lignes extraites pour ajuster.
            </p>
          )}
        </div>
      )}
    </div>
  );
}