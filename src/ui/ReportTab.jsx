import { useState } from "react";
import { C, s, mix } from "./theme.js";
import { Notice } from "./parts.jsx";
import { basketDocx, basketHtml, numberItems } from "../lib/word.js";
import { printHtml, safeName } from "../lib/export.js";

const BYLINE = "Made with Biostat Buddy";

export default function ReportTab({ items, setItems, narrow }) {
  const [title, setTitle] = useState("Results");
  const [withSentences, setWithSentences] = useState(true);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const numbered = numberItems(items);
  const move = (i, d) => { const a = [...items]; [a[i], a[i + d]] = [a[i + d], a[i]]; setItems(a); };
  const remove = i => setItems(items.filter((_, j) => j !== i));
  const opts = { title: title || "Results", author: BYLINE, withSentences };

  const word = async () => {
    setBusy("word"); setErr("");
    try {
      const blob = await basketDocx(items, opts);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${safeName(opts.title)}.docx`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    } catch (e) { setErr(`Could not make the Word file: ${e.message}`); }
    setBusy("");
  };
  const pdf = () => printHtml(basketHtml(items, opts), opts.title);

  if (!items.length) {
    return (
      <div style={{ ...s.card, color: C.muted, fontSize: 13, lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, color: C.text, fontSize: 15, marginBottom: 6 }}>Your report is empty</div>
        Run a test in <b style={{ color: C.text }}>Analyse</b> or make a <b style={{ color: C.text }}>Table 1</b>, then press <b style={{ color: C.text }}>＋ Add to report</b>.
        Everything you add is collected here as numbered tables (Table 1, Table 2…) and figures, ready to download as one Word file or PDF for your thesis results chapter.
        <div style={{ marginTop: 8, fontSize: 12 }}>Your report is saved on this device, so it is still here when you come back.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "300px minmax(0,1fr)", gap: 16, alignItems: "start" }}>
      <div style={{ ...s.card, position: narrow ? "static" : "sticky", top: 12 }}>
        <label style={{ display: "block", marginBottom: 12 }}><span style={s.label}>Report title</span>
          <input style={s.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 5: Results" /></label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={withSentences} onChange={e => setWithSentences(e.target.checked)} style={{ accentColor: C.accent }} /> Include the result in words
        </label>
        <div style={{ display: "grid", gap: 8 }}>
          <button type="button" style={s.btn} onClick={word} disabled={!!busy}>{busy === "word" ? "Making Word file…" : "⬇ Word (.docx)"}</button>
          <button type="button" style={{ ...s.btn, background: C.green }} onClick={pdf}>⬇ PDF</button>
          <button type="button" style={{ ...s.ghost, color: C.red, borderColor: mix(C.red, "66") }} onClick={() => { if (window.confirm("Remove everything from the report?")) setItems([]); }}>Clear report</button>
        </div>
        {err && <div style={{ marginTop: 10 }}><Notice tone="error">{err}</Notice></div>}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 12, lineHeight: 1.6 }}>
          {numbered.reduce((a, it) => a + it.tables.length, 0)} tables · {numbered.filter(it => it.chart).length} figures. Tables and figures are numbered in the order shown. Use ↑ ↓ to reorder.
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        {numbered.map((it, i) => (
          <div key={it.id} style={{ ...s.card, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{it.title}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{[it.subtitle, it.fileName].filter(Boolean).join(" · ")}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {it.tables.map(tb => <span key={tb.num} style={s.tag(C.accent)}>Table {tb.num}: {tb.title.length > 38 ? tb.title.slice(0, 37) + "…" : tb.title}</span>)}
                {it.figNum && <span style={s.tag(C.purple)}>Figure {it.figNum}</span>}
              </div>
              {withSentences && it.sentence && <div style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.55 }}>{it.sentence}</div>}
            </div>
            {it.chart && !narrow && <img src={it.chart.png} alt="" style={{ width: 120, borderRadius: 6, border: `1px solid ${C.border}`, background: "#fff" }} />}
            <div style={{ display: "grid", gap: 4 }}>
              <button type="button" aria-label="Move up" style={{ ...s.ghost, padding: "2px 9px" }} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" aria-label="Move down" style={{ ...s.ghost, padding: "2px 9px" }} disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" aria-label="Remove" style={{ ...s.ghost, padding: "2px 9px", color: C.red }} onClick={() => remove(i)}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
