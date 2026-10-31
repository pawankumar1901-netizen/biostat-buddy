// Biostat Buddy — reading files and turning raw cells into typed variables.
import Papa from "papaparse";

export const DEFAULT_MISSING = ["", "na", "n/a", "nan", "null", "none", "missing", ".", "-", "--", "?", "#n/a", "nil"];
const NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const THOUSANDS_RE = /^[+-]?\d{1,3}(,\d{2,3})+(\.\d+)?$/;

export const naturalCompare = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });

export function toNumber(s) {
  if (typeof s === "number") return s;
  const t = String(s).trim();
  if (NUM_RE.test(t)) return Number(t);
  if (THOUSANDS_RE.test(t)) return Number(t.replace(/,/g, ""));
  return NaN;
}

// ── File reading ─────────────────────────────────────────────────────────────
// The whole file is read into memory first, before anything else happens. On Android, a file
// picked from Drive/WhatsApp/Downloads can stop being readable once the picker is reset.
const CSV_EXT = ["csv", "txt", "tsv"], XL_EXT = ["xlsx", "xls", "ods", "xlsm"];
export async function readFile(file) {
  let buf;
  try { buf = await file.arrayBuffer(); }
  catch {
    throw new Error("Your phone did not let the app read this file. If it is in Google Drive, WhatsApp or email, download it to the phone first, then pick it from Downloads.");
  }
  if (!buf.byteLength) throw new Error("The file is empty.");
  const name = file.name || "";
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  const b = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  const isZip = b[0] === 0x50 && b[1] === 0x4b, isOle = b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
  if (CSV_EXT.includes(ext)) return readCSV(buf);
  if (XL_EXT.includes(ext)) return readExcel(buf);
  if (!XL_EXT.includes(ext) && !CSV_EXT.includes(ext) && ext && !/^(bin|tmp|download)$/.test(ext)) {
    throw new Error(`".${ext}" files are not supported. Upload a CSV, XLSX, XLS or ODS file.`);
  }
  if (isZip || isOle) return readExcel(buf);
  return readCSV(buf);
}
function decodeText(buf) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { return new TextDecoder("windows-1252").decode(buf); } // older Excel "CSV" saves on Windows
}
function readCSV(buf) {
  const res = Papa.parse(decodeText(buf), { skipEmptyLines: "greedy" });
  const aoa = (res.data || []).map(r => r.map(v => (v == null ? "" : String(v).trim())));
  const fatal = (res.errors || []).find(e => e.type !== "Delimiter" && e.code !== "TooFewFields" && e.code !== "TooManyFields");
  if (!aoa.length) throw new Error("The file is empty.");
  if (fatal && aoa.length < 2) throw new Error(`Could not read the CSV: ${fatal.message}`);
  return { sheets: [{ name: "CSV", aoa }] };
}
async function readExcel(buf) {
  const XLSX = await import("@e965/xlsx");
  let wb;
  try { wb = XLSX.read(buf, { type: "array", cellNF: true }); }
  catch (e) { throw new Error(`Could not read the Excel file: ${e.message}. If it is password-protected, remove the password and try again.`); }
  const pad = v => String(v).padStart(2, "0");
  const sheets = wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    if (!ws || !ws["!ref"]) return { name, aoa: [] };
    const range = XLSX.utils.decode_range(ws["!ref"]), aoa = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        let v = "";
        if (cell && cell.v != null) {
          if (cell.t === "n" && cell.z && XLSX.SSF.is_date(cell.z)) {
            // Convert Excel serial dates without going through JS Date (avoids IST/UTC day shifts)
            const d = XLSX.SSF.parse_date_code(cell.v);
            v = d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : String(cell.v);
          } else if (cell.t === "b") v = cell.v ? "TRUE" : "FALSE";
          else if (cell.t === "e") v = "";
          else v = String(cell.v).trim();
        }
        row.push(v);
      }
      if (row.some(x => x !== "")) aoa.push(row);
    }
    return { name, aoa };
  }).filter(s => s.aoa.length);
  if (!sheets.length) throw new Error("The Excel file has no data in any sheet.");
  return { sheets };
}

// First row (among the first 10) with the most filled cells is taken as the header.
export function guessHeaderRow(aoa) {
  let best = 0, bestCount = -1;
  for (let i = 0; i < Math.min(10, aoa.length - 1); i++) {
    const c = aoa[i].filter(v => v !== "").length;
    if (c > bestCount) { best = i; bestCount = c; }
  }
  return best;
}

// ── Dataset ──────────────────────────────────────────────────────────────────
// opts: { headerRow, missingCodes: string[], typeOverrides: {name: type} }
export function buildDataset(aoa, opts) {
  const headerRow = Math.min(Math.max(0, opts.headerRow || 0), Math.max(0, aoa.length - 1));
  const width = Math.max(...aoa.map(r => r.length));
  const header = aoa[headerRow] || [];
  const seen = {};
  const names = Array.from({ length: width }, (_, i) => {
    let n = String(header[i] ?? "").trim() || `Column ${i + 1}`;
    if (seen[n]) { seen[n]++; n = `${n} (${seen[n]})`; } else seen[n] = 1;
    return n;
  });
  const rows = aoa.slice(headerRow + 1)
    .map(r => names.map((_, i) => String(r[i] ?? "").trim()))
    .filter(r => r.some(v => v !== ""));
  if (!rows.length) throw new Error("No data rows found below the header row.");
  const missing = new Set([...DEFAULT_MISSING, ...(opts.missingCodes || []).map(s => s.trim().toLowerCase()).filter(Boolean)]);
  const isMissing = v => missing.has(v.toLowerCase());
  const vars = names.map((name, idx) => {
    let nMissing = 0, nNum = 0, allInt = true;
    const levelCounts = new Map(), display = new Map(), nums = [];
    for (const r of rows) {
      const v = r[idx];
      if (isMissing(v)) { nMissing++; continue; }
      const key = v.toLowerCase();
      if (!display.has(key)) display.set(key, new Map());
      const dm = display.get(key); dm.set(v, (dm.get(v) || 0) + 1);
      levelCounts.set(key, (levelCounts.get(key) || 0) + 1);
      const x = toNumber(v);
      if (Number.isFinite(x)) { nNum++; nums.push(x); if (!Number.isInteger(x)) allInt = false; }
    }
    const nValid = rows.length - nMissing;
    // Most common spelling becomes the label for each level ("yes", "Yes" → one level)
    const labelOf = new Map([...display].map(([k, m]) => [k, [...m].sort((a, b) => b[1] - a[1])[0][0]]));
    const levels = [...labelOf.values()].sort(naturalCompare);
    const nUnique = levels.length;
    let autoType, note = "";
    if (nValid === 0) { autoType = "ignore"; note = "Empty column"; }
    else if (nNum === nValid) {
      autoType = nUnique <= 2 ? "categorical" : "numeric";
      if (nUnique <= 2) note = "Two codes only — treated as categorical";
      else if (allInt && nUnique <= 6) note = "Few whole-number values — switch to categorical if these are codes";
    } else if (nNum / nValid >= 0.9 && nUnique > 6) {
      autoType = "numeric"; note = `${nValid - nNum} text value(s) will be treated as missing`;
    } else if (nUnique > 20 && nUnique > 0.5 * nValid) {
      autoType = "ignore"; note = "Looks like IDs or free text";
    } else autoType = "categorical";
    const type = opts.typeOverrides?.[name] || autoType;
    const [lo, hi] = nums.length ? nums.reduce(([a, b], v) => [Math.min(a, v), Math.max(b, v)], [Infinity, -Infinity]) : [NaN, NaN];
    return {
      name, idx, type, autoType, note, nValid, nMissing, nUnique, levels, labelOf,
      nNonNumeric: nValid - nNum, min: lo, max: hi,
      levelCounts: levels.map(l => levelCounts.get(l.toLowerCase())),
    };
  });
  const byName = Object.fromEntries(vars.map(v => [v.name, v]));
  const num = (row, name) => { const v = byName[name], s = row[v.idx]; return isMissing(s) ? NaN : toNumber(s); };
  const cat = (row, name) => { const v = byName[name], s = row[v.idx]; return isMissing(s) ? null : v.labelOf.get(s.toLowerCase()); };
  return { names, rows, vars, byName, num, cat, isMissing, headerRow };
}

// Helpers used by analyses
export const numVars = ds => ds.vars.filter(v => v.type === "numeric").map(v => v.name);
export const catVars = ds => ds.vars.filter(v => v.type === "categorical").map(v => v.name);
export function levelsOf(ds, name) {
  if (!name || !ds.byName[name]) return [];
  const set = new Set();
  for (const r of ds.rows) { const c = ds.cat(r, name); if (c != null) set.add(c); }
  return [...set].sort(naturalCompare);
}
