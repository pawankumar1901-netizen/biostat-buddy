// Biostat Buddy — copy to Word, download, and print/PDF. All user text is escaped.
import { cellText } from "./format.js";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const CELL = "border:1px solid #999;padding:4px 8px;font-family:Calibri,Arial,sans-serif;font-size:10.5pt;vertical-align:top;";

export function tableHtml(t, { withTitle = true } = {}) {
  const head = t.columns.map(c => `<th style="${CELL}background:#f2f2f2;text-align:left;">${esc(c)}</th>`).join("");
  const body = t.rows.map(r => `<tr>${r.map((c, i) => {
    const o = typeof c === "object" && c ? c : {};
    const style = `${CELL}${o.bold ? "font-weight:bold;" : ""}${o.indent ? "padding-left:22px;" : ""}${i > 0 ? "text-align:left;" : ""}`;
    return `<td style="${style}">${esc(cellText(c))}</td>`;
  }).join("")}</tr>`).join("");
  const title = withTitle && t.title ? `<p style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;margin:12px 0 4px;">${esc(t.title)}</p>` : "";
  const notes = (t.notes || []).filter(Boolean).map(n => `<p style="font-family:Calibri,Arial,sans-serif;font-size:9pt;margin:2px 0;color:#444;">${esc(n)}</p>`).join("");
  return `${title}<table style="border-collapse:collapse;">${`<thead><tr>${head}</tr></thead>`}<tbody>${body}</tbody></table>${notes}`;
}
export const tableText = t => [t.title, t.columns.join("\t"), ...t.rows.map(r => r.map(cellText).join("\t")), ...(t.notes || [])].filter(Boolean).join("\n");

// Copy as rich HTML so it pastes into Word / Google Docs as a real table.
export async function copyRich(html, text) {
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
      return true;
    }
  } catch { /* fall through */ }
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove();
  return ok;
}
export const copyText = text => copyRich(`<p>${esc(text)}</p>`, text);

function download(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function downloadDoc(html, filename) {
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(filename)}</title></head><body>${html}</body></html>`;
  download(new Blob(["﻿", doc], { type: "application/msword" }), filename.endsWith(".doc") ? filename : `${filename}.doc`);
}
export function downloadCSV(t, filename) {
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const csv = [t.columns.map(q).join(","), ...t.rows.map(r => r.map(c => q(cellText(c))).join(","))].join("\r\n");
  download(new Blob(["﻿", csv], { type: "text/csv" }), filename);
}
export const safeName = s => String(s || "report").replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").slice(0, 60);

// Print through a hidden iframe (works in the installed app, where pop-ups are blocked).
export function printHtml(bodyHtml, title) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page{margin:16mm} body{font-family:Georgia,serif;color:#111;font-size:11pt;line-height:1.5}
    .hdr{border-bottom:2px solid #1e3a8a;padding-bottom:8px;margin-bottom:14px}
    .by{font-size:9pt;color:#555;letter-spacing:1px;text-transform:uppercase}
    h1{font-size:18pt;color:#1e3a8a;margin:2px 0} .meta{font-size:9pt;color:#555}
    h2{font-size:12pt;color:#1e3a8a;margin:16px 0 6px} .box{border:1px solid #ccc;border-radius:4px;padding:8px 12px;margin:8px 0}
    .warn{border-color:#d4a017;background:#fff9e6} .chart svg{max-width:100%;height:auto} .chart{margin:8px 0;page-break-inside:avoid}
    table{page-break-inside:auto} tr{page-break-inside:avoid} .foot{margin-top:24px;border-top:1px solid #ccc;padding-top:6px;font-size:8pt;color:#777;text-align:center}
  </style></head><body>${bodyHtml}</body></html>`);
  doc.close();
  const go = () => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch { /* ignore */ }
    setTimeout(() => iframe.remove(), 60000);
  };
  setTimeout(go, 400);
}
