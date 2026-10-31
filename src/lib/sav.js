// Biostat Buddy — SPSS .sav / .zsav reader (no dependencies).
// Handles uncompressed, bytecode-compressed and zlib (.zsav) files, value labels, user-missing values,
// long variable names, very long strings, the file's text encoding and SPSS date formats.

const DATE_FMT = new Set([20, 22, 23, 24, 27, 28, 29, 38, 39]); // DATE ADATE JDATE … EDATE SDATE
const DATETIME_FMT = new Set([30, 41]);
const SPSS_EPOCH = Date.UTC(1582, 9, 14); // seconds since 14 Oct 1582
const pad = n => String(n).padStart(2, "0");

function spssDate(sec, withTime) {
  const d = new Date(SPSS_EPOCH + sec * 1000);
  if (Number.isNaN(d.getTime())) return "";
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return withTime ? `${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : day;
}
const numText = v => String(+v.toPrecision(15));

async function inflate(bytes) {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot open compressed .zsav files. Save it as .sav in SPSS, or use Chrome.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readSav(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  const magic = String.fromCharCode(...u8.slice(0, 4));
  if (magic !== "$FL2" && magic !== "$FL3") throw new Error("This is not an SPSS data file (.sav).");
  let le = true;
  { const lc = dv.getInt32(64, true); if (lc !== 2 && lc !== 3) le = false; }
  let pos = 0;
  const i32 = () => { const v = dv.getInt32(pos, le); pos += 4; return v; };
  const f64 = () => { const v = dv.getFloat64(pos, le); pos += 8; return v; };
  const bytes = n => { const b = u8.subarray(pos, pos + n); pos += n; return b; };

  pos = 72;
  const compression = i32(); i32(); /* weight */ const ncasesHdr = i32(); const bias = f64();
  pos = 176;

  const vars = [];           // one entry per 8-byte slot group (a "dictionary variable")
  const slotOwner = [];      // dictionary index (1-based slot) → vars index
  const labelSets = [];      // [{ map: Map(rawBytes8 → labelBytes), vars: [slot indexes] }]
  const ext = {};
  let sysmis = -Number.MAX_VALUE, charCode = 0;

  for (;;) {
    const rt = i32();
    if (rt === 2) {
      const type = i32(), hasLabel = i32(), nMiss = i32(), print = i32(); i32();
      const name = bytes(8);
      let label = null;
      if (hasLabel) { const len = i32(); label = bytes(len); pos += (4 - (len % 4)) % 4; }
      const miss = [];
      for (let k = 0; k < Math.abs(nMiss); k++) miss.push(pos), (pos += 8);
      slotOwner.push(type === -1 ? vars.length - 1 : vars.length);
      if (type === -1) continue;
      vars.push({ type, width: type, nameBytes: name, label, nMiss, missPos: miss, fmt: (print >> 16) & 0xff, slot: slotOwner.length - 1, labels: null });
    } else if (rt === 3) {
      const n = i32(), map = [];
      for (let k = 0; k < n; k++) { const raw = pos; pos += 8; const len = u8[pos]; pos += 1; const lab = bytes(len); pos += (8 - ((len + 1) % 8)) % 8; map.push([raw, lab]); }
      if (i32() !== 4) throw new Error("This .sav file looks damaged (value labels).");
      const nv = i32(), idx = []; for (let k = 0; k < nv; k++) idx.push(i32() - 1);
      labelSets.push({ map, idx });
    } else if (rt === 6) {
      const n = i32(); pos += 80 * n;
    } else if (rt === 7) {
      const sub = i32(), size = i32(), count = i32(), start = pos;
      ext[sub] = { start, len: size * count };
      if (sub === 3 && count >= 8) charCode = dv.getInt32(start + 28, le);
      if (sub === 4) sysmis = dv.getFloat64(start, le);
      pos = start + size * count;
    } else if (rt === 999) { i32(); break; }
    else throw new Error("This .sav file uses a layout Biostat Buddy cannot read.");
  }

  // Text encoding
  let enc = "windows-1252";
  if (ext[20]) enc = new TextDecoder("ascii").decode(u8.subarray(ext[20].start, ext[20].start + ext[20].len)).trim().toLowerCase();
  else if (charCode === 65001) enc = "utf-8";
  else if (charCode > 0 && charCode !== 2 && charCode !== 3) enc = `windows-${charCode}`;
  let dec;
  try { dec = new TextDecoder(enc); } catch { dec = new TextDecoder("windows-1252"); }
  const text = b => dec.decode(b).replace(/\0+$/, "").replace(/\s+$/, "");

  // Names: short names, then long names (subtype 13)
  for (const v of vars) v.name = text(v.nameBytes);
  if (ext[13]) {
    const longMap = new Map(text(u8.subarray(ext[13].start, ext[13].start + ext[13].len)).split("\t").map(p => { const i = p.indexOf("="); return [p.slice(0, i).toUpperCase(), p.slice(i + 1)]; }));
    for (const v of vars) if (longMap.has(v.name.toUpperCase())) v.name = longMap.get(v.name.toUpperCase());
  }
  // Measurement level (subtype 11): 1 nominal, 2 ordinal, 3 scale
  if (ext[11]) vars.forEach((v, i) => { if ((i + 1) * 12 <= ext[11].len) v.measure = dv.getInt32(ext[11].start + i * 12, le); });
  // Value labels
  for (const set of labelSets) {
    for (const slot of set.idx) {
      const v = vars[slotOwner[slot]];
      if (!v) continue;
      v.labels = new Map(set.map.map(([raw, lab]) => [v.type === 0 ? dv.getFloat64(raw, le) : text(u8.subarray(raw, raw + 8)), text(lab)]));
    }
  }
  // User-missing values
  for (const v of vars) {
    const vals = v.missPos.map(p => (v.type === 0 ? dv.getFloat64(p, le) : text(u8.subarray(p, p + 8))));
    v.isUserMissing = x => false;
    if (v.type === 0 && v.nMiss < 0) {
      const [lo, hi, d] = vals;
      v.isUserMissing = x => (x >= lo && x <= hi) || (v.nMiss === -3 && x === d);
    } else if (vals.length) {
      const set = new Set(vals);
      v.isUserMissing = x => set.has(x);
    }
  }
  // Very long strings (subtype 14): NAME=width — later segments are separate dictionary variables
  const segOf = new Map();
  if (ext[14]) {
    for (const p of dec.decode(u8.subarray(ext[14].start, ext[14].start + ext[14].len)).split(/[\0\t]+/)) {
      const [nm, w] = p.split("="); if (nm && +w > 255) segOf.set(nm.trim().toUpperCase(), Math.ceil(+w / 252));
    }
  }

  // ── Data ──
  const nSlots = slotOwner.length;
  let cells; // async iterator over 8-byte cells as {num, raw offset in src}
  let src = u8, sp = pos;
  if (compression === 2) {
    // zsav: zheader (3 × int64), then deflate blocks listed in the ztrailer
    const zhdr = pos, ztrailerOfs = Number(dv.getBigInt64(zhdr + 8, le));
    const nBlocks = dv.getInt32(ztrailerOfs + 20, le), parts = [];
    for (let b = 0; b < nBlocks; b++) {
      const e = ztrailerOfs + 24 + b * 24;
      const cofs = Number(dv.getBigInt64(e + 8, le)), csize = dv.getInt32(e + 20, le);
      parts.push(await inflate(u8.subarray(cofs, cofs + csize)));
    }
    const total = parts.reduce((a, p) => a + p.length, 0);
    src = new Uint8Array(total); let o = 0; for (const p of parts) { src.set(p, o); o += p.length; }
    sp = 0;
  }
  const sdv = new DataView(src.buffer, src.byteOffset, src.byteLength);
  const SPACES = new Uint8Array(8).fill(32);

  // Read one case (array of nSlots cells; each cell is a number or an 8-byte Uint8Array)
  let cmd = null, ci = 8;
  const readCase = () => {
    const out = new Array(nSlots);
    for (let s = 0; s < nSlots; s++) {
      const isStr = vars[slotOwner[s]].type !== 0;
      if (compression === 0) {
        if (sp + 8 > src.length) return null;
        out[s] = isStr ? src.subarray(sp, sp + 8) : sdv.getFloat64(sp, le);
        sp += 8; continue;
      }
      for (;;) {
        if (ci === 8) { if (sp + 8 > src.length) return null; cmd = src.subarray(sp, sp + 8); sp += 8; ci = 0; }
        const c = cmd[ci++];
        if (c === 0) continue;
        if (c === 252) return null;
        if (c === 253) { if (sp + 8 > src.length) return null; out[s] = isStr ? src.subarray(sp, sp + 8) : sdv.getFloat64(sp, le); sp += 8; }
        else if (c === 254) out[s] = isStr ? SPACES : NaN;
        else if (c === 255) out[s] = isStr ? SPACES : sysmis;
        else out[s] = isStr ? SPACES : c - bias;
        break;
      }
    }
    return out;
  };

  // Columns: merge very-long-string segments into one column
  const cols = [];
  for (let i = 0; i < vars.length; i++) {
    const v = vars[i], nseg = v.type > 0 ? segOf.get(v.name.toUpperCase()) || 1 : 1;
    cols.push({ v, segs: vars.slice(i, i + nseg) });
    i += nseg - 1;
  }
  const slotsOf = v => { const r = []; for (let s = 0; s < nSlots; s++) if (slotOwner[s] === vars.indexOf(v)) r.push(s); return r; };
  for (const c of cols) c.slots = c.segs.map(slotsOf);

  const raw = [];
  for (let n = 0; ncasesHdr < 0 || n < ncasesHdr; n++) {
    const cs = readCase();
    if (!cs) break;
    raw.push(cols.map(c => {
      if (c.v.type === 0) return cs[c.slots[0][0]];
      const parts = c.slots.map((sl, k) => { const b = new Uint8Array(sl.length * 8); sl.forEach((s, j) => b.set(cs[s], j * 8)); return c.segs.length > 1 && k < c.segs.length - 1 ? b.subarray(0, 255) : b; });
      const all = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
      return text(all);
    }));
  }

  // Decide per column whether to show value labels instead of codes
  const useLabels = cols.map(({ v }, j) => {
    if (!v.labels || !v.labels.size) return false;
    if (v.type !== 0) return true;
    if (v.measure === 2 || v.measure === 3) return false; // ordinal / scale keep their numbers
    if (v.labels.size > 12 && v.measure !== 1) return false;
    return raw.every(r => { const x = r[j]; return x === sysmis || Number.isNaN(x) || v.isUserMissing(x) || v.labels.has(x); });
  });

  const header = cols.map(c => c.v.name);
  const rows = raw.map(r => r.map((x, j) => {
    const { v } = cols[j];
    if (v.type !== 0) { if (v.isUserMissing(x)) return ""; return useLabels[j] && v.labels.has(x) ? v.labels.get(x) : x; }
    if (x === sysmis || Number.isNaN(x) || v.isUserMissing(x)) return "";
    if (useLabels[j]) return v.labels.get(x) ?? numText(x);
    if (DATE_FMT.has(v.fmt)) return spssDate(x, false);
    if (DATETIME_FMT.has(v.fmt)) return spssDate(x, true);
    return numText(x);
  }));
  const varLabels = Object.fromEntries(cols.filter(c => c.v.label).map(c => [c.v.name, text(c.v.label)]));
  return { sheets: [{ name: "SPSS data", aoa: [header, ...rows] }], varLabels };
}
