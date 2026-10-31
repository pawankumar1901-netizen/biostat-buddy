import { useMemo, useState } from "react";
import { C, s } from "./theme.js";
import { CopyButton, DataTable, Notice } from "./parts.jsx";
import { buildTable1 } from "../lib/table1.js";
import { catVars, numVars } from "../lib/data.js";
import { downloadCSV, downloadDoc, safeName, tableHtml, tableText } from "../lib/export.js";

export default function Table1Tab({ ds, narrow, opts, setOpts }) {
  const cats = catVars(ds), all = [...numVars(ds), ...cats].sort((a, b) => ds.byName[a].idx - ds.byName[b].idx);
  const group = cats.includes(opts.group) ? opts.group : "";
  const vars = (opts.vars ?? all).filter(v => all.includes(v) && v !== group);
  const [out, setOut] = useState(null);
  const key = JSON.stringify([group, vars, opts.numericMode, opts.showOverall, opts.showP, ds.rows.length, ds.vars.map(v => v.type)]);
  const [builtKey, setBuiltKey] = useState("");
  const update = patch => setOpts({ ...opts, group, vars, ...patch });
  const generate = () => {
    try { setOut({ table: buildTable1(ds, { ...opts, group, vars }) }); } catch (e) { setOut({ error: e.message }); }
    setBuiltKey(key);
  };
  const stale = out && builtKey !== key;
  const html = useMemo(() => (out?.table ? tableHtml(out.table) : ""), [out]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "320px minmax(0,1fr)", gap: 16, alignItems: "start" }}>
      <div style={s.card}>
        <label style={{ display: "block", marginBottom: 12 }}><span style={s.label}>Compare groups by</span>
          <select style={s.select} value={group} onChange={e => update({ group: e.target.value })}>
            <option value="">No groups (overall only)</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select></label>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={s.label}>Rows to include</span>
            <span style={{ fontSize: 11, display: "flex", gap: 10 }}>
              <button type="button" style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }} onClick={() => update({ vars: all.filter(v => v !== group) })}>All</button>
              <button type="button" style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }} onClick={() => update({ vars: [] })}>None</button>
            </span>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px 10px", maxHeight: 240, overflowY: "auto" }}>
            {all.filter(v => v !== group).map(v => (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={vars.includes(v)} style={{ accentColor: C.accent, width: 16, height: 16 }}
                  onChange={() => update({ vars: vars.includes(v) ? vars.filter(x => x !== v) : all.filter(x => x === v || vars.includes(x)) })} />
                <span style={{ flex: 1 }}>{v}</span>
                <span style={s.tag(ds.byName[v].type === "numeric" ? C.accent : C.purple)}>{ds.byName[v].type === "numeric" ? "num" : "cat"}</span>
              </label>
            ))}
          </div>
        </div>
        <label style={{ display: "block", marginBottom: 12 }}><span style={s.label}>Numeric variables as</span>
          <select style={s.select} value={opts.numericMode} onChange={e => update({ numericMode: e.target.value })}>
            <option value="auto">Automatic (checks normality)</option>
            <option value="mean">Always mean ± SD</option>
            <option value="median">Always median (IQR)</option>
          </select></label>
        {group && <>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, marginBottom: 8, cursor: "pointer" }}><input type="checkbox" checked={opts.showOverall} onChange={e => update({ showOverall: e.target.checked })} style={{ accentColor: C.accent }} /> Show overall column</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, marginBottom: 14, cursor: "pointer" }}><input type="checkbox" checked={opts.showP} onChange={e => update({ showP: e.target.checked })} style={{ accentColor: C.accent }} /> Show p-values</label>
        </>}
        <button type="button" style={{ ...s.btn, width: "100%", opacity: vars.length ? 1 : 0.5 }} disabled={!vars.length} onClick={generate}>▶ Make Table 1</button>
      </div>
      <div style={{ minWidth: 0 }}>
        {!out && <div style={{ ...s.card, color: C.muted, fontSize: 13, lineHeight: 1.7 }}>Pick a grouping variable (for example the outcome or study arm) and the characteristics to include, then press <b style={{ color: C.text }}>Make Table 1</b>. The right test is chosen for each row automatically.</div>}
        {out?.error && <Notice tone="error">⚠ {out.error}</Notice>}
        {out?.table && (
          <div style={s.card}>
            {stale && <Notice>Settings changed. Press Make Table 1 again to update.</Notice>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <CopyButton label="Copy for Word" getHtml={() => html} getText={() => tableText(out.table)} style={{ borderColor: C.accent, color: C.accent }} />
              <button type="button" style={s.ghost} onClick={() => downloadDoc(html, `${safeName(out.table.title)}.doc`)}>⬇ Word file</button>
              <button type="button" style={s.ghost} onClick={() => downloadCSV(out.table, `${safeName(out.table.title)}.csv`)}>⬇ CSV</button>
            </div>
            <DataTable table={out.table} copy={false} />
          </div>
        )}
      </div>
    </div>
  );
}
