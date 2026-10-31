import { useEffect, useRef } from "react";
import { C, s } from "./theme.js";
import { CopyButton } from "./parts.jsx";

export const SITE = "https://biostat.pawansdroid.in";
const ORCID = "0000-0001-7175-6372";

export default function CiteDialog({ onClose, version }) {
  const box = useRef(null);
  useEffect(() => {
    const k = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k); box.current?.focus();
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const year = new Date().getFullYear();
  const cited = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const refs = [
    ["Vancouver", `Pawan Kumar B. Biostat Buddy: free statistical analysis for medical theses [Internet]. Version ${version}. ${year} [cited ${cited}]. Available from: ${SITE}`],
    ["APA 7", `Pawan Kumar, B. (${year}). Biostat Buddy (Version ${version}) [Web application]. ${SITE}`],
    ["Methods sentence", `Data were analysed using Biostat Buddy version ${version} (Pawan Kumar B; ${SITE}), a browser-based statistics application; statistical significance was set at p < 0.05.`],
  ];
  return (
    <div role="presentation" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,15,25,.55)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="cite-h" onClick={e => e.stopPropagation()}
        style={{ ...s.card, width: "100%", maxWidth: 560, marginBottom: 0, maxHeight: "90vh", overflowY: "auto", outline: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 id="cite-h" style={{ fontSize: 17, margin: 0 }}>How to cite Biostat Buddy</h2>
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>
          If you used Biostat Buddy for your thesis or paper, please mention it in the methods and reference list.
          Developed by <b style={{ color: C.text }}>Dr. Pawan Kumar B</b>, Department of Community Medicine ·
          ORCID <a href={`https://orcid.org/${ORCID}`} target="_blank" rel="noopener noreferrer">{ORCID}</a>
        </div>
        {refs.map(([k, t]) => (
          <div key={k} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ ...s.label, margin: 0 }}>{k}</span>
              <CopyButton label="Copy" style={{ padding: "3px 9px", fontSize: 11 }} getText={() => t} />
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, wordBreak: "break-word" }}>{t}</div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>The statistical methods are standard and were checked against SciPy, statsmodels and lifelines. Always cite the original methods (for example, Kaplan & Meier 1958) where your university requires it.</div>
      </div>
    </div>
  );
}
