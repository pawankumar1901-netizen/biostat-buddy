import { useMemo } from "react";
import { C, s } from "./theme.js";
import { Notice } from "./parts.jsx";
import ReportView from "./ReportView.jsx";
import { TESTS, testById, resolveConfig } from "../lib/reports.js";
import { levelsOf } from "../lib/data.js";
import { RESULTS } from "../lib/guide.js";

const GROUPS = [...new Set(TESTS.map(t => t.group))];

export default function AnalyseTab({ ds, testId, setTestId, cfg, setCfg, result, run, running, fileName, narrow, onSwitch }) {
  const test = testById(testId);
  const { values, options } = useMemo(() => resolveConfig(testId, cfg, ds), [testId, cfg, ds]);
  const set = (key, val) => setCfg({ ...values, [key]: val });
  const togglePred = p => set("predictors", values.predictors.includes(p) ? values.predictors.filter(x => x !== p) : [...values.predictors, p]);
  const typeOf = n => ds.byName[n]?.type;

  const slotUI = slot => {
    const opts = options[slot.key] || [];
    if (slot.kind === "multi") {
      return (
        <div key={slot.key} style={{ marginBottom: 12 }}>
          <span style={s.label}>{slot.label}</span>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px 10px", maxHeight: 210, overflowY: "auto" }}>
            {opts.length === 0 && <div style={{ fontSize: 12, color: C.muted, padding: 6 }}>No other variables available.</div>}
            {opts.map(p => (
              <label key={p} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer", fontSize: 12 }}>
                <input type="checkbox" checked={values.predictors.includes(p)} onChange={() => togglePred(p)} style={{ accentColor: C.accent, width: 16, height: 16 }} />
                <span style={{ flex: 1, color: values.predictors.includes(p) ? C.text : C.muted }}>{p}</span>
                <span style={s.tag(typeOf(p) === "numeric" ? C.accent : C.purple)}>{typeOf(p) === "numeric" ? "num" : "cat"}</span>
              </label>
            ))}
          </div>
          {values.predictors.filter(p => typeOf(p) === "categorical").map(p => (
            <label key={p} style={{ display: "block", marginTop: 8 }}>
              <span style={{ ...s.label, textTransform: "none", letterSpacing: 0 }}>Reference category for {p}</span>
              <select style={s.select} value={values.refs[p]} onChange={e => setCfg({ ...values, refs: { ...values.refs, [p]: e.target.value } })}>
                {levelsOf(ds, p).map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          ))}
        </div>
      );
    }
    const missingWhat = slot.kind === "num" ? "numeric" : slot.kind === "cat" ? "categorical" : slot.kind === "level" ? "category" : "";
    return (
      <label key={slot.key} style={{ display: "block", marginBottom: 12 }}>
        <span style={s.label}>{slot.label}</span>
        {opts.length ? (
          <select style={s.select} value={values[slot.key]} onChange={e => set(slot.key, e.target.value)}>
            {opts.map(o => <option key={o} value={o}>{o}{slot.kind === "any" ? (typeOf(o) === "numeric" ? "  · num" : "  · cat") : ""}</option>)}
          </select>
        ) : <div style={{ fontSize: 12, color: C.yellow, padding: "6px 0" }}>No {missingWhat} variable available{slot.kind === "level" ? "" : " — check the types in the Data tab"}.</div>}
      </label>
    );
  };

  const ready = test.slots.every(sl => (sl.kind === "multi" ? values.predictors.length > 0 : !!values[sl.key]));

  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "320px minmax(0,1fr)", gap: 16, alignItems: "start" }}>
      <div style={{ ...s.card, position: narrow ? "static" : "sticky", top: 12 }}>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={s.label}>Test</span>
          <select style={s.select} value={testId} onChange={e => setTestId(e.target.value)}>
            {GROUPS.map(g => <optgroup key={g} label={g}>{TESTS.filter(t => t.group === g).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}
          </select>
        </label>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.55, marginBottom: 14 }}>{RESULTS[testId]?.[1]}</div>
        {test.slots.map(slotUI)}
        <button type="button" style={{ ...s.btn, width: "100%", opacity: ready && !running ? 1 : 0.5 }} onClick={() => run(values)} disabled={!ready || running}>
          {running ? "Running…" : "▶ Run analysis"}
        </button>
      </div>
      <div style={{ minWidth: 0 }}>
        {!result && <div style={{ ...s.card, color: C.muted, fontSize: 13, lineHeight: 1.7 }}>Choose a test and variables, then press <b style={{ color: C.text }}>Run analysis</b>. Not sure which test? Use the <b style={{ color: C.text }}>Test guide</b> tab.</div>}
        {result?.error && <Notice tone="error">⚠ {result.error}</Notice>}
        {result?.report && <ReportView key={result.id} report={result.report} fileName={fileName} narrow={narrow} onSwitch={onSwitch} />}
      </div>
    </div>
  );
}
