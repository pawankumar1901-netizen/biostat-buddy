import { useEffect, useMemo, useRef, useState } from "react";
import { C, FONT, s, useNarrow, useTheme, mix } from "./ui/theme.js";
import { Mark, Wordmark } from "./ui/Logo.jsx";
import { Notice } from "./ui/parts.jsx";
import DataTab from "./ui/DataTab.jsx";
import AnalyseTab from "./ui/AnalyseTab.jsx";
import Table1Tab from "./ui/Table1Tab.jsx";
import GuideTab from "./ui/GuideTab.jsx";
import { readFile, buildDataset, guessHeaderRow } from "./lib/data.js";
import { runTest, resolveConfig } from "./lib/reports.js";
import { demoSheet } from "./lib/demo.js";
import { SAMPLE_URL } from "./lib/guide.js";

const BYLINE = "Dr. Pawan Kumar B · Community Medicine";
const VERSION = "2.1";
const TABS = [["data", "Data"], ["analyse", "Analyse"], ["table1", "Table 1"], ["guide", "Test guide"]];

function ThemeButton({ theme, toggle }) {
  const dark = theme === "dark";
  return (
    <button type="button" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}
      style={{ ...s.ghost, width: 38, height: 38, padding: 0, display: "grid", placeItems: "center", borderRadius: 999 }}>
      {dark
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" /></svg>}
    </button>
  );
}
function Header({ children, narrow, theme, toggle }) {
  return (
    <header style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: narrow ? "10px 14px" : "12px 28px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10 }}>
        <Mark width={narrow ? 46 : 54} />
        <div>
          <Wordmark size={narrow ? 19 : 22} />
          <div style={{ fontSize: 9.5, color: C.muted, letterSpacing: 1.6, textTransform: "uppercase", marginTop: 4, fontWeight: 600 }}>{BYLINE}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {children}
        <ThemeButton theme={theme} toggle={toggle} />
      </div>
    </header>
  );
}
function Footer() {
  return (
    <footer style={{ textAlign: "center", fontSize: 12, color: C.muted, padding: "22px 16px 30px", lineHeight: 1.7, borderTop: `1px solid ${C.border}`, marginTop: 8, display: "grid", justifyItems: "center", gap: 8 }}>
      <div>Your data stays on this device. Only summary results are sent if you press AI explain.</div>
      <div>Biostat Buddy v{VERSION} · {BYLINE}</div>
      <a href="https://pawansdroid.in" target="_blank" rel="noopener" aria-label="pawansDr.oid — visit pawansdroid.in" style={{ display: "inline-block", marginTop: 4, opacity: 0.9 }}>
        <img className="pd-for-light" src="/pawansdroid-logo-dark.png" alt="pawansDr.oid" width="120" height="36" loading="lazy" style={{ width: 120, height: "auto" }} />
        <img className="pd-for-dark" src="/pawansdroid-logo.png" alt="pawansDr.oid" width="120" height="36" loading="lazy" style={{ width: 120, height: "auto" }} />
      </a>
    </footer>
  );
}

export default function App() {
  const narrow = useNarrow();
  const [theme, toggleTheme] = useTheme();
  const [file, setFile] = useState(null);          // { name, sheets }
  const [homeError, setHomeError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [missingText, setMissingText] = useState("");
  const [typeOverrides, setTypeOverrides] = useState({});
  const [tab, setTab] = useState("data");
  const [testId, setTestId] = useState("describe");
  const [cfg, setCfg] = useState({});
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [t1opts, setT1opts] = useState({ group: "", numericMode: "auto", showOverall: true, showP: true });
  const runId = useRef(0);
  const [autoRun, setAutoRun] = useState(false);

  const built = useMemo(() => {
    if (!file) return null;
    try {
      const aoa = file.sheets[sheetIdx]?.aoa || [];
      const missingCodes = missingText.split(",").map(x => x.trim()).filter(Boolean);
      return { ds: buildDataset(aoa, { headerRow, missingCodes, typeOverrides }) };
    } catch (e) { return { error: e.message }; }
  }, [file, sheetIdx, headerRow, missingText, typeOverrides]);
  const ds = built?.ds;

  // Any change to the data, test or selections clears the old result, so a result can never carry the wrong labels.
  useEffect(() => { setResult(null); }, [ds, testId, cfg]);

  const load = (name, sheets) => {
    setFile({ name, sheets }); setSheetIdx(0); setHeaderRow(guessHeaderRow(sheets[0].aoa));
    setTypeOverrides({}); setMissingText(""); setCfg({}); setResult(null); setTab("data"); setHomeError("");
    setT1opts({ group: "", numericMode: "auto", showOverall: true, showP: true });
  };
  const handleFile = async f => {
    if (!f) return;
    setLoading(true); setHomeError("");
    try { const { sheets } = await readFile(f); load(f.name, sheets); }
    catch (e) { setHomeError(e.message || "Could not read this file."); }
    finally { setLoading(false); }
  };
  const run = values => {
    const id = ++runId.current;
    setRunning(true);
    setTimeout(() => {
      let res;
      try { res = { id, report: runTest(testId, values, ds) }; } catch (e) { res = { id, error: e.message }; }
      if (id === runId.current) { setResult(res); setRunning(false); }
    }, 20);
  };
  // "Run Mann-Whitney instead" style suggestions switch the test and run it straight away.
  useEffect(() => {
    if (autoRun && ds) { setAutoRun(false); run(resolveConfig(testId, cfg, ds).values); }
  }, [autoRun, testId, cfg, ds]); // eslint-disable-line react-hooks/exhaustive-deps
  const newFile = () => { setFile(null); setResult(null); setHomeError(""); };

  const app = { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FONT, display: "flex", flexDirection: "column" };

  if (!file) {
    return (
      <div style={app}>
        <Header narrow={narrow} theme={theme} toggle={toggleTheme} />
        <main style={{ flex: 1, maxWidth: 760, width: "100%", margin: "0 auto", padding: narrow ? "36px 16px" : "64px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h1 style={{ fontSize: narrow ? 30 : 42, fontWeight: 900, letterSpacing: -2, lineHeight: 1.1, textAlign: "center", margin: 0 }}>
            No more SPSS panic<br /><span style={{ color: C.accent }}>at 2 AM.</span>
          </h1>
          <p style={{ color: C.muted, fontSize: 14, margin: "14px 0 34px", textAlign: "center", lineHeight: 1.6, maxWidth: 480 }}>
            Upload your data → pick a test → get thesis-ready tables and a result in words.
          </p>
          <label htmlFor="fileUpload"
            onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            style={{ border: `2px dashed ${dragOver ? C.accent : C.border}`, borderRadius: 16, padding: narrow ? "36px 20px" : "46px 56px", cursor: "pointer", textAlign: "center", background: dragOver ? mix(C.accent, "11") : C.card, width: "100%", maxWidth: 460, display: "block" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--accent)", marginBottom: 8 }}><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{loading ? "Reading file…" : "Tap or drop your file here"}</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>CSV · Excel (XLSX, XLS) · ODS</div>
            <div style={{ ...s.btn, display: "inline-block", marginTop: 16 }}>Browse file</div>
          </label>
          <input id="fileUpload" type="file" style={{ display: "none" }}
            accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet"
            onChange={e => { const input = e.target; handleFile(input.files?.[0]).finally(() => { input.value = ""; }); }} />
          {homeError && <div style={{ width: "100%", maxWidth: 460, marginTop: 14 }}><Notice tone="error">⚠ {homeError}</Notice></div>}
          <button type="button" style={{ ...s.ghost, marginTop: 16 }} onClick={() => load("Sample dataset", demoSheet().sheets)}>Try with a sample dataset</button>
          <div style={{ display: "flex", gap: 8, marginTop: 30, flexWrap: "wrap", justifyContent: "center" }}>
            {["t-test · ANOVA", "Mann-Whitney · Kruskal-Wallis", "Paired t · Wilcoxon · McNemar", "Chi-square · Fisher · OR/RR", "Pearson · Spearman", "Linear & logistic regression", "Table 1 for Word", "Test guide"].map(f => (
              <span key={f} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, fontSize: 11, padding: "5px 12px", color: C.muted }}>{f}</span>
            ))}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div style={app}>
      <Header narrow={narrow} theme={theme} toggle={toggleTheme}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ ...s.tag(C.green), maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }} title={file.name}>✓ {file.name}</span>
          {ds && <span style={s.tag(C.accent)}>{ds.rows.length} rows</span>}
          <button type="button" style={s.ghost} onClick={newFile}>New file</button>
        </div>
      </Header>
      <nav style={{ display: "flex", gap: 4, padding: narrow ? "8px 12px 0" : "10px 28px 0", borderBottom: `1px solid ${C.border}`, overflowX: "auto", background: C.bg }}>
        {TABS.map(([k, l]) => (
          <button type="button" key={k} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined}
            style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === k ? C.accent : "transparent"}`, color: tab === k ? C.text : C.muted, padding: "10px 12px", fontSize: 13, fontWeight: tab === k ? 700 : 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{l}</button>
        ))}
        <a href={SAMPLE_URL} target="_blank" rel="noopener noreferrer" style={{ color: C.muted, padding: "10px 12px", fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>Sample size ↗</a>
      </nav>
      <main style={{ flex: 1, maxWidth: 1200, width: "100%", margin: "0 auto", padding: narrow ? "14px 12px" : "22px 24px" }}>
        {built.error && <Notice tone="error">⚠ {built.error} Try a different header row or sheet below.</Notice>}
        {built.error && (
          <div style={s.card}>
            <label><span style={s.label}>Header row</span>
              <select style={s.select} value={headerRow} onChange={e => setHeaderRow(+e.target.value)}>
                {file.sheets[sheetIdx].aoa.slice(0, 10).map((r, i) => <option key={i} value={i}>Row {i + 1}</option>)}
              </select></label>
            {file.sheets.length > 1 && <label style={{ display: "block", marginTop: 10 }}><span style={s.label}>Sheet</span>
              <select style={s.select} value={sheetIdx} onChange={e => { const i = +e.target.value; setSheetIdx(i); setHeaderRow(guessHeaderRow(file.sheets[i].aoa)); }}>
                {file.sheets.map((sh, i) => <option key={i} value={i}>{sh.name}</option>)}
              </select></label>}
          </div>
        )}
        {ds && tab === "data" && (
          <DataTab ds={ds} sheets={file.sheets} sheetIdx={sheetIdx} narrow={narrow}
            setSheetIdx={i => { setSheetIdx(i); setHeaderRow(guessHeaderRow(file.sheets[i].aoa)); setTypeOverrides({}); }}
            headerRow={headerRow} setHeaderRow={r => { setHeaderRow(r); setTypeOverrides({}); }}
            missingText={missingText} setMissingText={setMissingText}
            setType={(name, t) => setTypeOverrides(o => ({ ...o, [name]: t }))} resetTypes={() => setTypeOverrides({})} />
        )}
        {ds && tab === "data" && <div style={{ textAlign: "right" }}><button type="button" style={s.btn} onClick={() => setTab("analyse")}>Next: Analyse →</button></div>}
        {ds && tab === "analyse" && <AnalyseTab ds={ds} testId={testId} setTestId={setTestId} cfg={cfg} setCfg={setCfg} result={result} run={run} running={running} fileName={file.name} narrow={narrow} onSwitch={(id, c) => { setTestId(id); setCfg(c); setAutoRun(true); }} />}
        {ds && tab === "table1" && <Table1Tab ds={ds} narrow={narrow} opts={t1opts} setOpts={setT1opts} />}
        {ds && tab === "guide" && <GuideTab onPick={id => { if (id === "table1") setTab("table1"); else { setTestId(id); setTab("analyse"); } }} />}
      </main>
      <Footer />
    </div>
  );
}
