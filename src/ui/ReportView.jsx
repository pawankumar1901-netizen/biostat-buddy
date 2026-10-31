import { useRef, useState } from "react";
import { C, s, mix } from "./theme.js";
import { CopyButton, DataTable, Notice } from "./parts.jsx";
import ChartView from "./Charts.jsx";
import { aiSummary, testById } from "../lib/reports.js";
import { chartSvg, downloadDataUrl, esc, printHtml, safeName, svgToPng, tableHtml } from "../lib/export.js";
import { fmtP } from "../lib/format.js";
import { glossFor } from "../lib/glossary.js";

const BYLINE = "Dr. Pawan Kumar B · Community Medicine";

function md(text) {
  // Minimal, safe markdown: escape first, then **bold** and line breaks.
  return esc(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
}

// Rasterise the chart currently on screen (for Word, PDF and PNG).
export async function captureChart(el, keys) {
  const sv = chartSvg(el, keys);
  if (!sv) return null;
  try { return { png: await svgToPng(sv), w: sv.w, h: sv.h }; } catch { return null; }
}

export default function ReportView({ report, fileName, onSwitch, narrow, onAdd }) {
  const chartRef = useRef(null);
  const [ai, setAi] = useState({ status: "idle", text: "" });
  const [mode, setMode] = useState("main");
  const [tip, setTip] = useState(null);
  const [added, setAdded] = useState("");
  const legendKeys = mode === "box" ? null : report.chart?.keys || (report.chart?.type === "km" && report.chart.series.length > 1 ? report.chart.series.map(x => x.label) : null);
  const downloadPng = async () => {
    const c = await captureChart(chartRef.current, legendKeys);
    if (c) downloadDataUrl(c.png, `${safeName(report.title + " " + report.subtitle)}.png`);
  };
  const addToReport = async () => {
    const chart = report.chart ? await captureChart(chartRef.current, legendKeys) : null;
    onAdd({ title: report.title, subtitle: report.subtitle, sentence: report.sentence, tables: report.tables, chart, fileName });
    setAdded("Added ✓"); setTimeout(() => setAdded(""), 1800);
  };

  const explain = async () => {
    setAi({ status: "loading", text: "" });
    try {
      const res = await fetch("/api/interpret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: aiSummary(report) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.text) throw new Error(data.error || `The AI service did not respond (error ${res.status}).`);
      setAi({ status: "done", text: data.text });
    } catch (e) {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      setAi({ status: "error", text: offline ? "You are offline. AI explanation needs internet; the result in words above works offline." : `${e.message} The result in words above is ready to use without AI.` });
    }
  };

  const exportPdf = () => {
    // Charts use theme variables; chartSvg swaps them for print colours and draws the legend in.
    const svgs = chartSvg(chartRef.current, legendKeys)?.svg || "";
    const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const html = `
      <div class="hdr"><div class="by">${esc(BYLINE)}</div><h1>${esc(report.title)}</h1>
      <div class="meta">${esc(report.subtitle)} · File: ${esc(fileName)} · ${esc(date)}</div></div>
      <h2>Result in words</h2><div class="box">${esc(report.sentence)}</div>
      ${report.warnings.length ? `<div class="box warn">${report.warnings.map(w => `⚠ ${esc(w)}`).join("<br/>")}</div>` : ""}
      ${svgs ? `<h2>Chart</h2><div class="chart">${svgs}</div>` : ""}
      ${report.tables.map(t => tableHtml(t)).join("")}
      ${ai.status === "done" ? `<h2>AI explanation</h2><div class="box">${md(ai.text)}</div><p style="font-size:8pt;color:#777">AI-generated; check against the tables above.</p>` : ""}
      <div class="foot">Biostat Buddy · ${esc(BYLINE)} · Printed ${esc(date)}</div>`;
    printHtml(html, `${report.title} - ${report.subtitle}`);
  };

  return (
    <div style={s.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{report.title}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{report.subtitle}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={{ ...s.btn, background: C.purple, padding: "8px 14px", fontSize: 12 }} onClick={explain} disabled={ai.status === "loading"}>{ai.status === "loading" ? "Explaining…" : "✨ AI explain"}</button>
          <button type="button" style={{ ...s.btn, background: C.green, padding: "8px 14px", fontSize: 12 }} onClick={exportPdf}>⬇ PDF</button>
          {onAdd && <button type="button" style={{ ...s.btn, padding: "8px 14px", fontSize: 12 }} onClick={addToReport}>{added || "＋ Add to report"}</button>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${narrow ? 120 : 140}px, 1fr))`, gap: 10, marginBottom: 14 }}>
        {report.cards.map(c => {
          const col = c.p != null ? (c.p < 0.05 ? C.green : C.red) : c.tone === "warn" ? C.yellow : c.tone === "good" ? C.green : C.accent;
          const g = glossFor(c.label);
          return (
            <div key={c.label} style={{ background: C.surface, border: `1px solid ${c.p != null ? mix(col, "66") : tip === c.label ? C.accent : C.border}`, borderRadius: 8, padding: "10px 12px", position: "relative" }}>
              <div style={{ fontSize: c.value.length > 16 ? 13 : 18, fontWeight: 800, color: col, wordBreak: "break-word", paddingRight: g ? 18 : 0 }}>{c.p != null && c.p < 0.001 ? "<0.001" : c.value}</div>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: 3 }}>{c.label}</div>
              {g && <button type="button" aria-label={`What does ${c.label} mean?`} aria-expanded={tip === c.label} onClick={() => setTip(tip === c.label ? null : c.label)}
                style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 999, border: `1px solid ${C.border}`, background: tip === c.label ? C.accent : C.card, color: tip === c.label ? C.onAccent : C.muted, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0, lineHeight: "18px", fontFamily: "inherit" }}>?</button>}
            </div>
          );
        })}
      </div>
      {tip && glossFor(tip) && (
        <div role="note" style={{ background: mix(C.accent, "12"), border: `1px solid ${mix(C.accent, "55")}`, borderRadius: 8, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.6, margin: "-4px 0 14px", display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>{!glossFor(tip).toLowerCase().startsWith(tip.toLowerCase().slice(0, 4)) && <b>{tip}: </b>}{glossFor(tip)}</div>
          <button type="button" aria-label="Close" onClick={() => setTip(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, alignSelf: "flex-start" }}>×</button>
        </div>
      )}

      {report.warnings.map((w, i) => <Notice key={i}>⚠ {w}</Notice>)}
      {report.suggestions.map((sg, i) => (
        <Notice key={`s${i}`} tone="info">
          💡 {sg.text}
          {sg.testId && <button type="button" style={{ ...s.ghost, marginLeft: 8, padding: "3px 9px", fontSize: 11, borderColor: C.accent, color: C.accent }} onClick={() => onSwitch(sg.testId, sg.cfg)}>Run {testById(sg.testId).name}</button>}
        </Notice>
      ))}

      <div style={{ background: C.surface, border: `1px solid ${mix(C.accent, "44")}`, borderRadius: 10, padding: "12px 14px", margin: "6px 0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
          <span style={{ ...s.h3, margin: 0, color: C.accent }}>Result in words</span>
          <CopyButton label="Copy" style={{ padding: "3px 9px", fontSize: 11 }} getText={() => report.sentence} getHtml={() => `<p>${esc(report.sentence)}</p>`} />
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.7, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>{report.sentence}</div>
      </div>

      {report.chart && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            {report.chart.box?.data.length > 0 && (
              <div role="group" aria-label="Chart type" style={{ display: "inline-flex", border: `1px solid ${C.border}`, borderRadius: 7, overflow: "hidden" }}>
                {[["main", report.chart.type === "hist" ? "Histogram" : "Bars"], ["box", "Box plot"]].map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} style={{ border: "none", padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", background: mode === k ? C.accent : C.card, color: mode === k ? C.onAccent : C.muted }}>{l}</button>
                ))}
              </div>
            )}
            <button type="button" style={{ ...s.ghost, padding: "4px 10px", fontSize: 11 }} onClick={downloadPng}>⬇ Chart image</button>
          </div>
          <div ref={chartRef}><ChartView chart={report.chart} mode={mode} /></div>
        </div>
      )}
      {report.tables.map((t, i) => <DataTable key={i} table={t} />)}

      {ai.status === "done" && (
        <div style={{ background: C.surface, border: `1px solid ${mix(C.purple, "44")}`, borderRadius: 10, padding: 14, marginTop: 8 }}>
          <div style={{ ...s.h3, color: C.purple }}>✨ AI explanation</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }} dangerouslySetInnerHTML={{ __html: md(ai.text) }} />
          <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>AI-generated. Check it against the tables above before using it.</div>
        </div>
      )}
      {ai.status === "error" && <Notice tone="error">{ai.text}</Notice>}
      <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>Significant results (p {"<"} 0.05) are shown in green. p-values below 0.001 are shown as {fmtP(0.0001)}.</div>
    </div>
  );
}
