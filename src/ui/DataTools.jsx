import { useState } from "react";
import { C, s, mix } from "./theme.js";
import { Notice } from "./parts.jsx";
import { catVars, numVars, levelsOf } from "../lib/data.js";
import { STEP_TEXT, cutLabels, parseFormula } from "../lib/transform.js";

const TOOLS = [
  ["recode", "Merge categories", "e.g. SES I + II → Upper"],
  ["cut", "Make groups", "e.g. Age → <30, 30–44, ≥45"],
  ["compute", "Compute", "e.g. BMI from weight and height"],
  ["filter", "Subgroup filter", "e.g. only females, age ≥ 18"],
];
const OPS_NUM = [">", "≥", "<", "≤", "=", "≠"], OPS_CAT = ["is", "is not"];

function uniqueName(ds, base) {
  let n = base, i = 2;
  while (ds.byName[n]) n = `${base}_${i++}`;
  return n;
}

export default function DataTools({ ds, steps, setSteps, errors, filter, narrow }) {
  const [tool, setTool] = useState(null);
  const [form, setForm] = useState({});
  const [err, setErr] = useState("");
  const cats = catVars(ds), nums = numVars(ds);
  const open = t => {
    setErr(""); setTool(t);
    if (t === "recode") { const v = cats[0] || ""; setForm({ source: v, name: v ? uniqueName(ds, `${v}_grp`) : "", map: {} }); }
    if (t === "cut") { const v = nums.find(n => /age/i.test(n)) || nums[0] || ""; setForm({ source: v, name: v ? uniqueName(ds, `${v}_grp`) : "", cuts: "" }); }
    if (t === "compute") {
      const w = nums.find(n => /weight|wt\b/i.test(n)), h = nums.find(n => /height|ht\b/i.test(n));
      setForm({ name: uniqueName(ds, w && h ? "BMI_calc" : "New_variable"), formula: w && h ? `[${w}] / ([${h}] / 100)^2` : "" });
    }
    if (t === "filter") setForm({ conds: [{ v: cats[0] || nums[0] || "", op: cats[0] ? "is" : ">", value: cats[0] ? levelsOf(ds, cats[0])[0] || "" : "" }] });
  };
  const add = () => {
    try {
      let st;
      if (tool === "recode") {
        const map = Object.fromEntries(Object.entries(form.map).filter(([, v]) => v.trim()));
        if (!Object.keys(map).length) throw new Error("Type a new name next to at least one category.");
        st = { type: "recode", source: form.source, name: form.name.trim(), map };
      } else if (tool === "cut") {
        const cuts = form.cuts.split(/[,;\s]+/).filter(Boolean).map(Number);
        if (!cuts.length || cuts.some(x => !Number.isFinite(x))) throw new Error("Type the cut-off values as numbers, separated by commas.");
        st = { type: "cut", source: form.source, name: form.name.trim(), cuts: [...new Set(cuts)].sort((a, b) => a - b) };
      } else if (tool === "compute") {
        parseFormula(form.formula, ds.names);
        st = { type: "compute", name: form.name.trim(), formula: form.formula.trim() };
      } else {
        if (form.conds.some(c => !c.v || String(c.value).trim() === "")) throw new Error("Fill in every condition.");
        st = { type: "filter", conds: form.conds };
      }
      if (st.type !== "filter") {
        if (!st.name) throw new Error("Give the new variable a name.");
        if (ds.byName[st.name]) throw new Error(`"${st.name}" already exists. Choose another name.`);
      }
      setSteps([...steps, st]); setTool(null);
    } catch (e) { setErr(e.message); }
  };
  const set = patch => setForm(f => ({ ...f, ...patch }));
  const cutPreview = () => { const c = form.cuts.split(/[,;\s]+/).filter(Boolean).map(Number); return c.length && c.every(Number.isFinite) ? cutLabels([...new Set(c)].sort((a, b) => a - b), c.every(Number.isInteger)).join(" · ") : ""; };
  let formulaMsg = "";
  if (tool === "compute" && form.formula) { try { parseFormula(form.formula, ds.names); formulaMsg = "✓ Formula looks right"; } catch (e) { formulaMsg = e.message; } }

  return (
    <div style={s.card}>
      <h3 style={s.h3}>Data tools</h3>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>Make new variables without touching your file. They appear in every test and in Table 1.</div>
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr 1fr" : "repeat(4, minmax(0,1fr))", gap: 8 }}>
        {TOOLS.map(([k, l, hint]) => (
          <button key={k} type="button" onClick={() => open(k)} aria-pressed={tool === k}
            style={{ ...s.ghost, textAlign: "left", padding: "9px 11px", borderColor: tool === k ? C.accent : C.border, background: tool === k ? mix(C.accent, "10") : C.card }}>
            <div style={{ fontWeight: 700, fontSize: 12.5, color: C.text }}>{l}</div>
            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>{hint}</div>
          </button>
        ))}
      </div>

      {tool && (
        <div style={{ border: `1px solid ${mix(C.accent, "55")}`, borderRadius: 10, padding: 12, marginTop: 12, background: C.surface }}>
          {tool === "recode" && (cats.length ? <>
            <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 10 }}>
              <label><span style={s.label}>Variable</span>
                <select style={s.select} value={form.source} onChange={e => set({ source: e.target.value, name: uniqueName(ds, `${e.target.value}_grp`), map: {} })}>{cats.map(c => <option key={c}>{c}</option>)}</select></label>
              <label><span style={s.label}>New variable name</span><input style={s.input} value={form.name} onChange={e => set({ name: e.target.value })} /></label>
            </div>
            <span style={{ ...s.label, marginTop: 10 }}>New category for each old one (leave blank to keep)</span>
            {levelsOf(ds, form.source).map(l => (
              <div key={l} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: 12 }}>{l}</span><span style={{ color: C.muted }}>→</span>
                <input style={{ ...s.input, flex: 1.3 }} value={form.map[l] || ""} placeholder={l} onChange={e => set({ map: { ...form.map, [l]: e.target.value } })} />
              </div>
            ))}
          </> : <Notice>No categorical variables to merge.</Notice>)}

          {tool === "cut" && (nums.length ? <>
            <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 10 }}>
              <label><span style={s.label}>Numeric variable</span>
                <select style={s.select} value={form.source} onChange={e => set({ source: e.target.value, name: uniqueName(ds, `${e.target.value}_grp`) })}>{nums.map(c => <option key={c}>{c}</option>)}</select></label>
              <label><span style={s.label}>New variable name</span><input style={s.input} value={form.name} onChange={e => set({ name: e.target.value })} /></label>
            </div>
            <label style={{ display: "block", marginTop: 10 }}><span style={s.label}>Cut-offs (start of each new group)</span>
              <input style={s.input} value={form.cuts} placeholder="e.g. 30, 45, 60" inputMode="decimal" onChange={e => set({ cuts: e.target.value })} /></label>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
              {ds.byName[form.source] && `${form.source} ranges from ${ds.byName[form.source].min} to ${ds.byName[form.source].max}. `}
              {cutPreview() ? <>Groups: <b style={{ color: C.text }}>{cutPreview()}</b></> : "BMI (Asian cut-offs): 18.5, 23, 25 · Hb (anaemia): 11"}
            </div>
          </> : <Notice>No numeric variables to group.</Notice>)}

          {tool === "compute" && <>
            <label style={{ display: "block" }}><span style={s.label}>New variable name</span><input style={s.input} value={form.name} onChange={e => set({ name: e.target.value })} /></label>
            <label style={{ display: "block", marginTop: 10 }}><span style={s.label}>Formula</span>
              <input style={{ ...s.input, fontFamily: "ui-monospace, Menlo, Consolas, monospace" }} value={form.formula} placeholder="[Weight] / ([Height] / 100)^2" onChange={e => set({ formula: e.target.value })} /></label>
            {formulaMsg && <div style={{ fontSize: 11, marginTop: 6, color: formulaMsg.startsWith("✓") ? C.green : C.yellow }}>{formulaMsg}</div>}
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>
              Put names in [square brackets]. Use + − * / ^ and brackets. Functions: log, log10, sqrt, abs, round(x, 1), mean(a, b, c), sum(a, b, c).
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {nums.slice(0, 12).map(n => <button key={n} type="button" style={{ ...s.ghost, padding: "2px 8px", fontSize: 11 }} onClick={() => set({ formula: `${form.formula}${form.formula && !/[\s(+\-*/^,]$/.test(form.formula) ? " " : ""}[${n}]` })}>{n}</button>)}
              </div>
            </div>
          </>}

          {tool === "filter" && <>
            <span style={s.label}>Keep only rows where (all must be true)</span>
            {form.conds.map((c, i) => {
              const isCat = ds.byName[c.v]?.type === "categorical";
              const upd = patch => set({ conds: form.conds.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: narrow ? "1fr 1fr" : "1.4fr 0.8fr 1.2fr auto", gap: 6, marginBottom: 6 }}>
                  <select style={s.select} value={c.v} onChange={e => { const v = e.target.value, cat = ds.byName[v]?.type === "categorical"; upd({ v, op: cat ? "is" : ">", value: cat ? levelsOf(ds, v)[0] || "" : "" }); }}>
                    {[...cats, ...nums].map(n => <option key={n}>{n}</option>)}
                  </select>
                  <select style={s.select} value={c.op} onChange={e => upd({ op: e.target.value })}>{(isCat ? OPS_CAT : OPS_NUM).map(o => <option key={o}>{o}</option>)}</select>
                  {isCat
                    ? <select style={s.select} value={c.value} onChange={e => upd({ value: e.target.value })}>{levelsOf(ds, c.v).map(l => <option key={l}>{l}</option>)}</select>
                    : <input style={s.input} value={c.value} inputMode="decimal" placeholder="number" onChange={e => upd({ value: e.target.value })} />}
                  <button type="button" aria-label="Remove condition" style={{ ...s.ghost, padding: "4px 10px" }} disabled={form.conds.length === 1} onClick={() => set({ conds: form.conds.filter((_, j) => j !== i) })}>×</button>
                </div>
              );
            })}
            <button type="button" style={{ ...s.ghost, padding: "4px 10px", fontSize: 11 }} onClick={() => set({ conds: [...form.conds, { v: nums[0] || cats[0], op: nums[0] ? ">" : "is", value: "" }] })}>＋ AND another condition</button>
          </>}

          {err && <div style={{ marginTop: 10 }}><Notice tone="error">{err}</Notice></div>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" style={s.btn} onClick={add}>{tool === "filter" ? "Apply filter" : "Create variable"}</button>
            <button type="button" style={s.ghost} onClick={() => setTool(null)}>Cancel</button>
          </div>
        </div>
      )}

      {steps.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <span style={s.label}>Applied ({steps.length})</span>
          {steps.map((st, i) => {
            const e = errors.find(x => x.i === i);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: `1px solid ${e ? mix(C.red, "66") : C.border}`, borderRadius: 7, marginBottom: 6, fontSize: 12 }}>
                <span style={s.tag(st.type === "filter" ? C.yellow : C.green)}>{st.type === "filter" ? "filter" : "new"}</span>
                <span style={{ flex: 1, wordBreak: "break-word" }}>{STEP_TEXT[st.type](st)}{e && <span style={{ color: C.red }}> — {e.msg}</span>}</span>
                <button type="button" aria-label="Undo this step" style={{ ...s.ghost, padding: "2px 9px" }} onClick={() => setSteps(steps.filter((_, j) => j !== i))}>×</button>
              </div>
            );
          })}
          {filter && <div style={{ fontSize: 11, color: C.muted }}>Filter keeps {filter.kept} of {filter.total} rows.</div>}
        </div>
      )}
    </div>
  );
}
