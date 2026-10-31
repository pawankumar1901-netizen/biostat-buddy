import { useRef, useState } from "react";
import { C, PALETTE, s } from "./theme.js";
import { CopyButton, DataTable, Notice } from "./parts.jsx";
import ChartView from "./Charts.jsx";
import { aiSummary, testById } from "../lib/reports.js";
import { esc, printHtml, tableHtml } from "../lib/export.js";
import { fmtP } from "../lib/format.js";

const BYLINE = "Dr. Pawan Kumar B · Community Medicine";

function md(text) {
  // Minimal, safe markdown: escape first, then **bold** and line breaks.
  return esc(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
}

export default function ReportView({ report, fileName, onSwitch, narrow }) {
  const chartRef = useRef(null);
  const [ai, setAi] = useState({ status: "idle", text: "" });

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
    const main = chartRef.current?.querySelector(".recharts-wrapper > svg.recharts-surface");
    const legend = report.chart?.keys ? `<div style="font-size:9pt;margin-top:4px">${report.chart.keys.map((k, i) => `<span style="display:inline-block;width:10px;height:10px;background:${PALETTE[i % PALETTE.length]};margin:0 4px 0 10px"></span>${esc(k)}`).join("")}</div>` : "";
    const svgs = main ? main.outerHTML + legend : "";
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
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${narrow ? 120 : 140}px, 1fr))`, gap: 10, marginBottom: 14 }}>
        {report.cards.map(c => {
          const col = c.p != null ? (c.p < 0.05 ? C.green : C.red) : c.tone === "warn" ? C.yellow : c.tone === "good" ? C.green : C.accent;
          return (
            <div key={c.label} style={{ background: C.surface, border: `1px solid ${c.p != null ? col + "66" : C.border}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: c.value.length > 16 ? 13 : 18, fontWeight: 800, color: col, wordBreak: "break-word" }}>{c.p != null && c.p < 0.001 ? "<0.001" : c.value}</div>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: 3 }}>{c.label}</div>
            </div>
          );
        })}
      </div>

      {report.warnings.map((w, i) => <Notice key={i}>⚠ {w}</Notice>)}
      {report.suggestions.map((sg, i) => (
        <Notice key={`s${i}`} tone="info">
          💡 {sg.text}
          {sg.testId && <button type="button" style={{ ...s.ghost, marginLeft: 8, padding: "3px 9px", fontSize: 11, borderColor: C.accent, color: C.accent }} onClick={() => onSwitch(sg.testId, sg.cfg)}>Run {testById(sg.testId).name}</button>}
        </Notice>
      ))}

      <div style={{ background: C.surface, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: "12px 14px", margin: "6px 0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
          <span style={{ ...s.h3, margin: 0, color: C.accent }}>Result in words</span>
          <CopyButton label="Copy" style={{ padding: "3px 9px", fontSize: 11 }} getText={() => report.sentence} getHtml={() => `<p>${esc(report.sentence)}</p>`} />
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.7, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>{report.sentence}</div>
      </div>

      {report.chart && <div ref={chartRef} style={{ marginBottom: 16 }}><ChartView chart={report.chart} /></div>}
      {report.tables.map((t, i) => <DataTable key={i} table={t} />)}

      {ai.status === "done" && (
        <div style={{ background: C.surface, border: `1px solid ${C.purple}44`, borderRadius: 10, padding: 14, marginTop: 8 }}>
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
