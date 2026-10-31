import { useState } from "react";
import { C, s, mix } from "./theme.js";
import { cellText } from "../lib/format.js";
import { copyRich, tableHtml, tableText } from "../lib/export.js";

export function CopyButton({ label = "Copy", getHtml, getText, style }) {
  const [state, setState] = useState("");
  const go = async () => {
    const ok = await copyRich(getHtml ? getHtml() : `<p>${getText()}</p>`, getText());
    setState(ok ? "Copied ✓" : "Copy failed");
    setTimeout(() => setState(""), 1800);
  };
  return <button type="button" style={{ ...s.ghost, ...style }} onClick={go}>{state || label}</button>;
}

export function DataTable({ table, copy = true }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{table.title}</div>
        {copy && <CopyButton label="Copy table" style={{ padding: "4px 9px", fontSize: 11 }} getHtml={() => tableHtml(table)} getText={() => tableText(table)} />}
      </div>
      <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 360 }}>
          <thead><tr>{table.columns.map((h, i) => <th key={i} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>{table.rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => {
              const o = typeof c === "object" && c ? c : {};
              return <td key={j} style={{ ...s.td, fontWeight: o.bold ? 700 : 400, paddingLeft: o.indent ? 24 : 10, color: o.sig ? C.green : C.text, whiteSpace: j === 0 ? "normal" : "nowrap" }}>{cellText(c)}</td>;
            })}</tr>
          ))}</tbody>
        </table>
      </div>
      {(table.notes || []).filter(Boolean).map((n, i) => <div key={i} style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{n}</div>)}
    </div>
  );
}

export function Notice({ tone = "warn", children }) {
  const col = tone === "warn" ? C.yellow : tone === "error" ? C.red : C.accent;
  return <div role={tone === "error" ? "alert" : undefined} style={{ background: mix(col, "18"), border: `1px solid ${mix(col, "55")}`, color: tone === "info" ? C.text : col, borderRadius: 8, padding: "9px 12px", fontSize: 12, lineHeight: 1.55, marginBottom: 10 }}>{children}</div>;
}

export function Field({ label, children }) {
  return <label style={{ display: "block", marginBottom: 12 }}><span style={s.label}>{label}</span>{children}</label>;
}
