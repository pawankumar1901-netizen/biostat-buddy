import { useEffect, useState } from "react";
import { C, s } from "./theme.js";
import { Notice } from "./parts.jsx";
import { fmt } from "../lib/format.js";

const TYPES = [["numeric", "Numeric"], ["categorical", "Categorical"], ["ignore", "Ignore"]];
const typeCol = t => (t === "numeric" ? C.accent : t === "categorical" ? C.purple : C.muted);

export default function DataTab({ ds, sheets, sheetIdx, setSheetIdx, headerRow, setHeaderRow, missingText, setMissingText, setType, resetTypes, narrow }) {
  const [missDraft, setMissDraft] = useState(missingText);
  useEffect(() => setMissDraft(missingText), [missingText]);
  const complete = ds.rows.filter(r => ds.vars.filter(v => v.type !== "ignore").every(v => !ds.isMissing(r[v.idx]))).length;
  const overridden = ds.vars.some(v => v.type !== v.autoType);
  return (
    <div>
      <div style={s.card}>
        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(3, minmax(0,1fr))", gap: 12 }}>
          {sheets.length > 1 && (
            <label><span style={s.label}>Sheet</span>
              <select style={s.select} value={sheetIdx} onChange={e => setSheetIdx(+e.target.value)}>
                {sheets.map((sh, i) => <option key={i} value={i}>{sh.name}</option>)}
              </select></label>
          )}
          <label><span style={s.label}>Header row (column names)</span>
            <select style={s.select} value={headerRow} onChange={e => setHeaderRow(+e.target.value)}>
              {sheets[sheetIdx].aoa.slice(0, 10).map((r, i) => <option key={i} value={i}>Row {i + 1}: {r.filter(Boolean).slice(0, 3).join(", ").slice(0, 40)}</option>)}
            </select></label>
          <label><span style={s.label}>Extra missing-value codes</span>
            <input style={s.input} value={missDraft} placeholder="e.g. 99, 999, NR" onChange={e => setMissDraft(e.target.value)} onBlur={() => setMissingText(missDraft)} onKeyDown={e => e.key === "Enter" && setMissingText(missDraft)} /></label>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>
          Blank cells and NA, N/A, null, ".", "-" are always treated as missing — never as zero. {ds.rows.length} rows · {ds.vars.length} columns · {complete} rows complete on all analysed variables.
        </div>
      </div>

      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <h3 style={{ ...s.h3, margin: 0 }}>Variables</h3>
          {overridden && <button type="button" style={{ ...s.ghost, padding: "4px 9px", fontSize: 11 }} onClick={resetTypes}>Reset types</button>}
        </div>
        <Notice tone="info">Check the <b>Type</b> column. Codes such as 1/2 for sex or 0/1 for yes/no must be <b>Categorical</b>. Set ID numbers and remarks to <b>Ignore</b>.</Notice>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 620 }}>
            <thead><tr>{["Variable", "Type", "Valid", "Missing", "Values", "Note"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>{ds.vars.map(v => (
              <tr key={v.name}>
                <td style={{ ...s.td, fontWeight: 700, maxWidth: 180, wordBreak: "break-word" }}>{v.name}</td>
                <td style={s.td}>
                  <select aria-label={`Type of ${v.name}`} value={v.type} onChange={e => setType(v.name, e.target.value)} style={{ ...s.select, width: 128, padding: "5px 6px", fontSize: 12, borderColor: typeCol(v.type) + "88", color: typeCol(v.type) }}>
                    {TYPES.map(([k, l]) => <option key={k} value={k} disabled={k === "numeric" && v.nValid > 0 && v.nNonNumeric === v.nValid}>{l}</option>)}
                  </select>
                </td>
                <td style={s.td}>{v.nValid}</td>
                <td style={{ ...s.td, color: v.nMissing ? C.yellow : C.muted }}>{v.nMissing ? `${v.nMissing} (${fmt((100 * v.nMissing) / ds.rows.length, 0)}%)` : "0"}</td>
                <td style={{ ...s.td, color: C.muted, maxWidth: 260 }}>
                  {v.type === "numeric" ? `${fmt(v.min, 2)} to ${fmt(v.max, 2)}` : v.nUnique > 8 ? `${v.nUnique} different values` : v.levels.map((l, i) => `${l} (${v.levelCounts[i]})`).join(", ")}
                </td>
                <td style={{ ...s.td, color: C.muted, fontSize: 11, maxWidth: 240 }}>{v.note}{v.type !== v.autoType ? (v.note ? " · " : "") + "changed by you" : ""}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div style={s.card}>
        <h3 style={s.h3}>Data preview (first 30 rows)</h3>
        <div style={{ overflow: "auto", maxHeight: 420, border: `1px solid ${C.border}`, borderRadius: 8 }}>
          <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
            <thead><tr><th style={{ ...s.th, position: "sticky", top: 0, background: C.surface }}>#</th>{ds.names.map(n => <th key={n} style={{ ...s.th, position: "sticky", top: 0, background: C.surface }}>{n}</th>)}</tr></thead>
            <tbody>{ds.rows.slice(0, 30).map((r, i) => (
              <tr key={i}><td style={{ ...s.td, color: C.muted }}>{i + 1}</td>{r.map((c, j) => {
                const miss = ds.isMissing(c);
                return <td key={j} style={{ ...s.td, whiteSpace: "nowrap", color: miss ? C.yellow : C.text, background: miss ? C.yellow + "10" : "transparent" }}>{miss ? (c === "" ? "·" : c) : c}</td>;
              })}</tr>
            ))}</tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Missing cells are highlighted in yellow.</div>
      </div>
    </div>
  );
}
