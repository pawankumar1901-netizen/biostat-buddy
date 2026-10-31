// Biostat Buddy — report basket: numbered tables and figures, exported to Word (.docx) or PDF.
import { cellText } from "./format.js";
import { esc, tableHtml } from "./export.js";

// Number every table and figure across the whole report, in order.
export function numberItems(items) {
  let t = 0, f = 0;
  return items.map(it => ({
    ...it,
    tables: it.tables.map(tb => ({ ...tb, num: ++t })),
    figNum: it.chart ? ++f : null,
  }));
}
const tableCaption = (it, tb) => `Table ${tb.num}: ${tb.title}${it.subtitle && it.tables.length === 1 ? ` (${it.subtitle})` : ""}`;
const figCaption = it => `Figure ${it.figNum}: ${it.title}${it.subtitle ? ` — ${it.subtitle}` : ""}`;

export async function basketDocx(items, { title, author, withSentences }) {
  const d = await import("docx");
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, AlignmentType, BorderStyle, HeadingLevel, Footer } = d;
  const FONT = "Calibri", SZ = 21; // 10.5 pt
  const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || SZ, bold: o.bold, italics: o.italics, color: o.color });
  const para = (text, o = {}) => new Paragraph({ children: [run(text, o)], spacing: { before: o.before ?? 0, after: o.after ?? 80 }, alignment: o.align, heading: o.heading, keepNext: o.keepNext });
  const border = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const children = [para(title, { size: 32, bold: true, after: 60, heading: HeadingLevel.TITLE }), para(author, { size: 18, color: "555555", after: 240 })];
  for (const it of numberItems(items)) {
    children.push(para(it.title, { bold: true, size: 26, before: 240, after: 80, heading: HeadingLevel.HEADING_2, keepNext: true }));
    if (withSentences && it.sentence) children.push(para(it.sentence, { after: 160 }));
    if (it.chart) {
      const bin = Uint8Array.from(atob(it.chart.png.split(",")[1]), ch => ch.charCodeAt(0));
      const w = Math.min(600, it.chart.w), h = Math.round((it.chart.h * w) / it.chart.w);
      children.push(new Paragraph({ children: [new ImageRun({ type: "png", data: bin, transformation: { width: w, height: h } })], alignment: AlignmentType.CENTER, keepNext: true }));
      children.push(para(figCaption(it), { italics: true, size: 19, align: AlignmentType.CENTER, after: 200 }));
    }
    for (const tb of it.tables) {
      children.push(para(tableCaption(it, tb), { bold: true, before: 160, after: 60, keepNext: true }));
      const mk = (cells, head) => new TableRow({ tableHeader: head, cantSplit: true, children: cells.map((c, j) => {
        const o = typeof c === "object" && c ? c : {};
        return new TableCell({ borders, shading: head ? { fill: "F2F2F2" } : undefined, margins: { top: 40, bottom: 40, left: o.indent ? 300 : 100, right: 100 },
          children: [new Paragraph({ children: [run(cellText(c), { bold: head || o.bold })], alignment: j > 0 && !head ? AlignmentType.LEFT : undefined })] });
      }) });
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [mk(tb.columns, true), ...tb.rows.map(r => mk(r, false))] }));
      for (const n of (tb.notes || []).filter(Boolean)) children.push(para(n, { size: 18, color: "444444", after: 20 }));
    }
  }
  const doc = new Document({
    creator: "Biostat Buddy", title,
    styles: { default: { document: { run: { font: FONT, size: SZ } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children,
      footers: { default: new Footer({ children: [para("Made with Biostat Buddy · biostat.pawansdroid.in", { size: 16, color: "888888", align: AlignmentType.CENTER })] }) } }],
  });
  return Packer.toBlob(doc);
}

export function basketHtml(items, { title, author, withSentences }) {
  return `<div class="hdr"><div class="by">${esc(author)}</div><h1>${esc(title)}</h1></div>` + numberItems(items).map(it => `
    <h2>${esc(it.title)}</h2>
    ${withSentences && it.sentence ? `<div class="box">${esc(it.sentence)}</div>` : ""}
    ${it.chart ? `<div class="chart"><img src="${it.chart.png}" style="max-width:100%;width:${Math.min(600, it.chart.w)}px"/><p style="font-style:italic;font-size:9.5pt;text-align:center;margin:2px 0 10px">${esc(figCaption(it))}</p></div>` : ""}
    ${it.tables.map(tb => tableHtml({ ...tb, title: tableCaption(it, tb) })).join("")}`).join("") +
    `<div class="foot">Made with Biostat Buddy · biostat.pawansdroid.in</div>`;
}
