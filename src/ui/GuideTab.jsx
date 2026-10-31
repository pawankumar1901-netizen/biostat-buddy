import { useState } from "react";
import { C, s } from "./theme.js";
import { GUIDE, RESULTS, SAMPLE_URL } from "../lib/guide.js";

export default function GuideTab({ onPick }) {
  const [path, setPath] = useState(["start"]);
  const cur = path[path.length - 1];
  const isResult = cur.startsWith("r:");
  const node = GUIDE[cur], res = isResult ? cur.slice(2) : null;
  return (
    <div style={{ ...s.card, maxWidth: 720 }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 14, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={s.h3}>Which test should I use?</span>
        {path.length > 1 && <button type="button" style={{ ...s.ghost, padding: "3px 9px", fontSize: 11 }} onClick={() => setPath(path.slice(0, -1))}>← Back</button>}
        {path.length > 1 && <button type="button" style={{ ...s.ghost, padding: "3px 9px", fontSize: 11 }} onClick={() => setPath(["start"])}>Start again</button>}
      </div>
      {!isResult && (
        <>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{node.q}</div>
          {node.hint && <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>{node.hint}</div>}
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {node.options.map(([label, next]) => (
              <button type="button" key={label} onClick={() => setPath([...path, next])}
                style={{ textAlign: "left", background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 9, padding: "12px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", lineHeight: 1.4 }}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      {isResult && (
        <div>
          <div style={{ fontSize: 11, color: C.green, textTransform: "uppercase", letterSpacing: 1.5 }}>Use</div>
          <div style={{ fontSize: 20, fontWeight: 800, margin: "4px 0 8px" }}>{RESULTS[res][0]}</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 16 }}>{RESULTS[res][1]}</div>
          {res === "sample"
            ? <a href={SAMPLE_URL} target="_blank" rel="noopener noreferrer" style={{ ...s.btn, display: "inline-block", textDecoration: "none" }}>Open Sample Size Calculator ↗</a>
            : <button type="button" style={s.btn} onClick={() => onPick(res)}>Open {RESULTS[res][0]} →</button>}
        </div>
      )}
    </div>
  );
}
