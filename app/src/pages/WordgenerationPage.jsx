// npm install jszip
import { useMemo, useRef, useState } from "react";
import JSZip from "jszip";

const NS = {
  w: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  pic: "http://schemas.openxmlformats.org/drawingml/2006/picture",
  wp: "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  v: "urn:schemas-microsoft-com:vml",
  rels: "http://schemas.openxmlformats.org/package/2006/relationships",
  ct: "http://schemas.openxmlformats.org/package/2006/content-types",
  xml: "http://www.w3.org/XML/1998/namespace",
};
const W = NS.w;
const DOC = "word/document.xml";
const RELS = "word/_rels/document.xml.rels";
const CT = "[Content_Types].xml";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const IMG_MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", webp: "image/webp", svg: "image/svg+xml" };

const parseXml = (s) => new DOMParser().parseFromString(s, "application/xml");
const serialize = (doc) => {
  const s = new XMLSerializer().serializeToString(doc);
  return s.startsWith("<?xml") ? s : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + s;
};

/* ---------- Lecture ---------- */

const isOn = (rPr, tag) => {
  const el = rPr?.getElementsByTagNameNS(W, tag)[0];
  if (!el) return false;
  const v = el.getAttributeNS(W, "val");
  return v !== "0" && v !== "false" && v !== "none";
};
const attr = (rPr, tag, name = "val") => rPr?.getElementsByTagNameNS(W, tag)[0]?.getAttributeNS(W, name) || null;

function runText(run) {
  let out = "";
  for (const n of run.childNodes) {
    if (n.namespaceURI !== W) continue;
    if (n.localName === "t") out += n.textContent;
    else if (n.localName === "tab") out += "\t";
    else if (n.localName === "br" || n.localName === "cr") out += "\n";
  }
  return out;
}

async function extractRuns(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file(DOC)?.async("string");
  if (!xml) throw new Error("word/document.xml introuvable : fichier .docx invalide ?");
  const doc = parseXml(xml);

  const rels = new Map();
  const relsXml = await zip.file(RELS)?.async("string");
  if (relsXml) for (const e of parseXml(relsXml).getElementsByTagName("Relationship")) rels.set(e.getAttribute("Id"), e.getAttribute("Target"));

  const paras = new Map();
  Array.from(doc.getElementsByTagNameNS(W, "p")).forEach((p, i) => paras.set(p, i));
  const counters = new Map();

  // Liste unique de tous les runs dans l'ordre du document : l'index sert d'identifiant
  const runs = Array.from(doc.getElementsByTagNameNS(W, "r")).map((r, id) => {
    let p = r.parentNode;
    while (p && !(p.namespaceURI === W && p.localName === "p")) p = p.parentNode;
    const n = counters.get(p) ?? 0;
    counters.set(p, n + 1);
    const rPr = Array.from(r.children).find((c) => c.localName === "rPr");
    const sz = attr(rPr, "sz");
    let rIds = Array.from(r.getElementsByTagNameNS(NS.a, "blip")).map((b) => b.getAttributeNS(NS.r, "embed"));
    if (!rIds.length) rIds = Array.from(r.getElementsByTagNameNS(NS.v, "imagedata")).map((b) => b.getAttributeNS(NS.r, "id"));
    return {
      id, paragraph: paras.get(p) ?? -1, run: n, text: runText(r),
      bold: isOn(rPr, "b"), italic: isOn(rPr, "i"), underline: isOn(rPr, "u"), strike: isOn(rPr, "strike"),
      color: attr(rPr, "color"), highlight: attr(rPr, "highlight"), fontSize: sz ? Number(sz) / 2 : null,
      font: attr(rPr, "rFonts", "ascii"), style: attr(rPr, "rStyle"), rIds: rIds.filter(Boolean),
    };
  });

  // Images du document
  const cache = new Map();
  for (const rid of new Set(runs.flatMap((r) => r.rIds))) {
    const target = rels.get(rid);
    const path = target && (target.startsWith("/") ? target.slice(1) : `word/${target}`);
    const f = path && zip.file(path);
    if (!f) continue;
    const ext = path.split(".").pop().toLowerCase();
    const data = await f.async("uint8array");
    cache.set(rid, { ext, url: IMG_MIME[ext] ? URL.createObjectURL(new Blob([data], { type: IMG_MIME[ext] })) : null });
  }
  return runs.map((r) => ({ ...r, images: r.rIds.map((i) => cache.get(i)).filter(Boolean) }));
}

/* ---------- Écriture ---------- */

const clearRun = (run) =>
  Array.from(run.childNodes).forEach((c) => {
    if (!(c.namespaceURI === W && c.localName === "rPr")) run.removeChild(c); // on garde la mise en forme
  });

function setRunText(doc, run, value) {
  clearRun(run);
  value.split("\n").forEach((line, i) => {
    if (i > 0) run.appendChild(doc.createElementNS(W, "w:br"));
    const t = doc.createElementNS(W, "w:t");
    t.setAttributeNS(NS.xml, "xml:space", "preserve");
    t.textContent = line;
    run.appendChild(t);
  });
}

function setRunImage(doc, run, rId, id, ext, cx, cy) {
  clearRun(run);
  const drawing = parseXml(
    `<w:drawing xmlns:w="${W}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}" xmlns:r="${NS.r}">` +
      `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Image ${id}"/>` +
      `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
      `<a:graphic><a:graphicData uri="${NS.pic}"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="image${id}.${ext}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
      `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`
  ).documentElement;
  run.appendChild(doc.importNode(drawing, true));
}

// Repart toujours du fichier d'origine : le fichier chargé n'est jamais modifié
async function buildDocx(buffer, groups, values) {
  const zip = await JSZip.loadAsync(buffer);
  const doc = parseXml(await zip.file(DOC).async("string"));
  const all = Array.from(doc.getElementsByTagNameNS(W, "r"));
  let relsDoc = null, ctDoc = null, imgCount = 0;
  let docPrId = Math.max(0, ...Array.from(doc.getElementsByTagNameNS(NS.wp, "docPr")).map((e) => Number(e.getAttribute("id")) || 0));

  for (const g of groups) {
    const v = values[g.id];
    const els = g.runIds.map((i) => all[i]).filter(Boolean);
    if (!v || !els.length) continue;

    if (v.mode === "text" && v.text !== "") {
      setRunText(doc, els[0], v.text);
    } else if (v.mode === "image" && v.image) {
      relsDoc = relsDoc || parseXml(await zip.file(RELS).async("string"));
      ctDoc = ctDoc || parseXml(await zip.file(CT).async("string"));
      const { file, ext, w, h } = v.image;
      const n = ++imgCount;
      const name = `wr_image${n}.${ext}`;
      const rId = `rIdWR${n}`;
      zip.file(`word/media/${name}`, await file.arrayBuffer());

      const rel = relsDoc.createElementNS(NS.rels, "Relationship");
      rel.setAttribute("Id", rId);
      rel.setAttribute("Type", `${NS.r}/image`);
      rel.setAttribute("Target", `media/${name}`);
      relsDoc.documentElement.appendChild(rel);

      const known = Array.from(ctDoc.getElementsByTagName("Default")).some((d) => d.getAttribute("Extension").toLowerCase() === ext);
      if (!known) {
        const d = ctDoc.createElementNS(NS.ct, "Default");
        d.setAttribute("Extension", ext);
        d.setAttribute("ContentType", IMG_MIME[ext]);
        ctDoc.documentElement.insertBefore(d, ctDoc.documentElement.firstChild);
      }
      const cx = Math.round(v.widthCm * 360000); // 1 cm = 360 000 EMU
      setRunImage(doc, els[0], rId, ++docPrId, ext, cx, Math.round((cx * h) / w));
    } else continue;

    els.slice(1).forEach((r) => r.parentNode?.removeChild(r)); // les autres runs du groupe disparaissent
  }

  zip.file(DOC, serialize(doc));
  if (relsDoc) zip.file(RELS, serialize(relsDoc));
  if (ctDoc) zip.file(CT, serialize(ctDoc));
  return zip.generateAsync({ type: "blob", mimeType: DOCX_MIME, compression: "DEFLATE" });
}

/* ---------- Interface ---------- */

const s = {
  page: { maxWidth: 1200, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif", textAlign: "left" },
  bar: { position: "sticky", top: 0, background: "#fff", padding: "10px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid #ddd", zIndex: 1 },
  th: { textAlign: "left", padding: "6px 10px", borderBottom: "2px solid #ccc", whiteSpace: "nowrap" },
  td: { padding: "6px 10px", borderBottom: "1px solid #eee", verticalAlign: "top" },
  chip: { display: "inline-flex", gap: 6, alignItems: "center", padding: "4px 10px", margin: "4px 6px 4px 0", background: "#eef3ff", border: "1px solid #c5d3f5", borderRadius: 16, fontSize: 13 },
  card: { border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 14 },
};
const flag = (v) => (v ? "✓" : "");
const COLS = [
  ["Gras", (r) => flag(r.bold)], ["Italique", (r) => flag(r.italic)], ["Souligné", (r) => flag(r.underline)], ["Barré", (r) => flag(r.strike)],
  ["Couleur", (r) => r.color && (<><i style={{ display: "inline-block", width: 12, height: 12, background: `#${r.color}`, border: "1px solid #999", marginRight: 6 }} />{r.color}</>)],
  ["Surlign.", (r) => r.highlight], ["Taille", (r) => (r.fontSize ? `${r.fontSize} pt` : "")], ["Police", (r) => r.font], ["Style", (r) => r.style],
];
const Thumb = ({ img }) => img.url ? <img src={img.url} alt="" style={{ maxHeight: 60, maxWidth: 140, display: "block", marginTop: 4 }} /> : <em style={{ color: "#999" }}>[image .{img.ext}]</em>;

export default function WordgenerationPage() {
  const [step, setStep] = useState("select");
  const [fileName, setFileName] = useState("");
  const [runs, setRuns] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const bufferRef = useRef(null);
  const lastIdx = useRef(null);

  const groupOf = useMemo(() => {
    const m = new Map();
    groups.forEach((g) => g.runIds.forEach((id) => m.set(id, g)));
    return m;
  }, [groups]);
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? runs.filter((r) => r.text.toLowerCase().includes(q)) : runs;
  }, [runs, filter]);

  const groupText = (g) => g.runIds.map((id) => runs[id].text).join("");
  const val = (id) => values[id] ?? { mode: "text", text: "", image: null, widthCm: 4 };
  const setVal = (id, patch) => setValues((p) => ({ ...p, [id]: { ...val(id), ...patch } }));
  const changed = groups.filter((g) => { const v = values[g.id]; return v && (v.mode === "text" ? v.text !== "" : !!v.image); }).length;

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(""); setStatus("");
    runs.forEach((r) => r.images.forEach((i) => i.url && URL.revokeObjectURL(i.url)));
    try {
      const buffer = await file.arrayBuffer();
      const result = await extractRuns(buffer);
      bufferRef.current = buffer;
      setFileName(file.name); setRuns(result); setGroups([]); setSelected(new Set()); setValues({}); setStep("select");
    } catch (err) { setError(err.message); }
  };

  const toggle = (r, i, shift) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && lastIdx.current !== null) {
        const [a, b] = [lastIdx.current, i].sort((x, y) => x - y);
        for (let k = a; k <= b; k++) if (!groupOf.has(visible[k].id)) next.add(visible[k].id);
      } else if (next.has(r.id)) next.delete(r.id);
      else next.add(r.id);
      return next;
    });
    lastIdx.current = i;
  };

  const createGroup = () => {
    setGroups((g) => [...g, { id: crypto.randomUUID(), name: name.trim(), runIds: [...selected].sort((a, b) => a - b) }]);
    setSelected(new Set()); setName(""); lastIdx.current = null;
  };

  const pickImage = (id, file) => {
    if (!file) return;
    const ext = { "image/png": "png", "image/jpeg": "jpeg", "image/gif": "gif" }[file.type];
    if (!ext) return setError("Format non pris en charge : PNG, JPEG ou GIF.");
    setError("");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setVal(id, { image: { file, ext, url, w: img.naturalWidth, h: img.naturalHeight } });
    img.src = url;
  };

  const save = async () => {
    setError(""); setStatus("");
    const suggestedName = fileName.replace(/\.docx$/i, "") + "_modifié.docx";
    try {
      let handle = null;
      // Le sélecteur d'emplacement doit être ouvert directement depuis le clic
      if (window.showSaveFilePicker) {
        handle = await window.showSaveFilePicker({ suggestedName, types: [{ description: "Document Word", accept: { [DOCX_MIME]: [".docx"] } }] });
      }
      setBusy(true);
      const blob = await buildDocx(bufferRef.current, groups, values);
      if (handle) {
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = suggestedName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
      setStatus(`Enregistré : ${handle?.name ?? suggestedName}`);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally { setBusy(false); }
  };

  /* ----- Page 2 : remplissage des groupes ----- */
  if (step === "fill") {
    return (
      <div style={s.page}>
        <div style={s.bar}>
          <button onClick={() => setStep("select")}>← Retour</button>
          <strong>Valeurs des groupes</strong>
          <span style={{ color: "#666" }}>Un groupe laissé vide reste inchangé.</span>
          <button style={{ marginLeft: "auto" }} disabled={!changed || busy} onClick={save}>
            {busy ? "Enregistrement…" : `Enregistrer (${changed} groupe${changed > 1 ? "s" : ""})`}
          </button>
        </div>
        {error && <p style={{ color: "#b00020" }}>{error}</p>}
        {status && <p style={{ color: "#1b7f3b" }}>{status}</p>}

        <div style={{ marginTop: 16 }}>
          {groups.map((g) => {
            const v = val(g.id);
            return (
              <div key={g.id} style={s.card}>
                <h3 style={{ margin: "0 0 6px" }}>{g.name}</h3>
                <div style={{ color: "#555", marginBottom: 10, whiteSpace: "pre-wrap" }}>
                  Actuel : {groupText(g) || <em>(vide)</em>}
                  {g.runIds.flatMap((id) => runs[id].images).map((img, i) => <Thumb key={i} img={img} />)}
                </div>
                <label><input type="radio" checked={v.mode === "text"} onChange={() => setVal(g.id, { mode: "text" })} /> Texte</label>{" "}
                <label><input type="radio" checked={v.mode === "image"} onChange={() => setVal(g.id, { mode: "image" })} /> Image</label>
                <div style={{ marginTop: 8 }}>
                  {v.mode === "text" ? (
                    <textarea rows={2} style={{ width: "100%", boxSizing: "border-box" }} value={v.text} placeholder="Nouvelle valeur" onChange={(e) => setVal(g.id, { text: e.target.value })} />
                  ) : (
                    <>
                      <input type="file" accept="image/png,image/jpeg,image/gif" onChange={(e) => pickImage(g.id, e.target.files?.[0])} />{" "}
                      Largeur <input type="number" min="0.5" step="0.5" style={{ width: 60 }} value={v.widthCm} onChange={(e) => setVal(g.id, { widthCm: Number(e.target.value) || 4 })} /> cm
                      {v.image && <img src={v.image.url} alt="" style={{ display: "block", maxHeight: 80, marginTop: 8 }} />}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ----- Page 1 : runs, images et regroupement ----- */
  return (
    <div style={s.page}>
      <h1 style={{ fontSize: 22 }}>Runs d’un fichier Word</h1>
      <div style={s.bar}>
        <input type="file" accept=".docx" onChange={onFile} />
        {runs.length > 0 && (
          <>
            <input style={{ width: 260 }} placeholder="Nom du groupe (ex : date de signature)" value={name} onChange={(e) => setName(e.target.value)} />
            <button disabled={!name.trim() || !selected.size} onClick={createGroup}>Créer le groupe ({selected.size})</button>
            <input placeholder="Filtrer par texte…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <button style={{ marginLeft: "auto" }} disabled={!groups.length} onClick={() => setStep("fill")}>Suivant →</button>
          </>
        )}
      </div>
      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      {runs.length > 0 && (
        <>
          <p>
            <strong>{fileName}</strong> : {runs.length} runs, {runs.filter((r) => r.images.length).length} contenant une image.
            Astuce : Maj + clic sélectionne une plage de lignes.
          </p>
          <div>
            {groups.map((g) => (
              <span key={g.id} style={s.chip}>
                <strong>{g.name}</strong> “{groupText(g)}”
                <button onClick={() => setGroups((x) => x.filter((y) => y.id !== g.id))} title="Supprimer le groupe">✕</button>
              </span>
            ))}
          </div>

          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
              <thead>
                <tr>
                  {["", "P", "R", "Contenu", ...COLS.map((c) => c[0]), "Groupe"].map((h, i) => <th key={i} style={s.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  const g = groupOf.get(r.id);
                  return (
                    <tr key={r.id} style={{ background: selected.has(r.id) ? "#e8f0fe" : g ? "#f4f4f4" : undefined }}>
                      <td style={s.td}>
                        <input type="checkbox" disabled={!!g} checked={selected.has(r.id)} onChange={(e) => toggle(r, i, e.nativeEvent.shiftKey)} />
                      </td>
                      <td style={s.td}>{r.paragraph}</td>
                      <td style={s.td}>{r.run}</td>
                      <td style={{ ...s.td, whiteSpace: "pre-wrap", minWidth: 200 }}>
                        {r.text || (!r.images.length && <em style={{ color: "#999" }}>(vide)</em>)}
                        {r.images.map((img, k) => <Thumb key={k} img={img} />)}
                      </td>
                      {COLS.map(([label, fn]) => <td key={label} style={s.td}>{fn(r)}</td>)}
                      <td style={s.td}>{g?.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}