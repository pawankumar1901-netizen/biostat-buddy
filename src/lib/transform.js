// Biostat Buddy — data tools: merge categories, make groups from cut-offs, compute new variables, filter.
// Steps run in order on the raw table; each step adds a column (or removes rows) and the dataset is rebuilt.
import { buildDataset, toNumber } from "./data.js";

// ── Safe formula parser (no eval) ────────────────────────────────────────────
// Variables: [Any name] or a bare name. Operators + − × ÷ ^ and brackets. Functions below.
const FUNCS = {
  log: Math.log, ln: Math.log, log10: Math.log10, sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp,
  round: (x, d = 0) => { const f = 10 ** d; return Math.round(x * f) / f; },
  mean: (...a) => a.reduce((s, v) => s + v, 0) / a.length, sum: (...a) => a.reduce((s, v) => s + v, 0),
  min: Math.min, max: Math.max,
};
export function parseFormula(src, names) {
  const toks = [], re = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)|\[([^\]]+)\]|([A-Za-z_][\w.]*)|(\*\*|[-+*/^(),×÷]))/y;
  let m, i = 0;
  re.lastIndex = 0;
  while (i < src.length) {
    if (/^\s*$/.test(src.slice(i))) break;
    re.lastIndex = i; m = re.exec(src);
    if (!m) throw new Error(`Could not understand "${src.slice(i).trim().slice(0, 12)}".`);
    i = re.lastIndex;
    if (m[1]) toks.push({ t: "num", v: Number(m[1]) });
    else if (m[2]) toks.push({ t: "var", v: m[2].trim() });
    else if (m[3]) toks.push({ t: "id", v: m[3] });
    else toks.push({ t: "op", v: { "×": "*", "÷": "/", "**": "^" }[m[4]] || m[4] });
  }
  let p = 0;
  const peek = () => toks[p], eat = v => { if (peek()?.v !== v) throw new Error(`Expected "${v}".`); p++; };
  const used = new Set();
  const varRef = name => {
    const real = names.find(n => n === name) || names.find(n => n.toLowerCase() === name.toLowerCase());
    if (!real) throw new Error(`No variable called "${name}".`);
    used.add(real);
    return get => get(real);
  };
  function primary() {
    const tk = toks[p++];
    if (!tk) throw new Error("The formula ends too early.");
    if (tk.t === "num") return () => tk.v;
    if (tk.t === "var") return varRef(tk.v);
    if (tk.t === "id") {
      if (peek()?.v === "(" && FUNCS[tk.v.toLowerCase()]) {
        p++; const args = [expr()];
        while (peek()?.v === ",") { p++; args.push(expr()); }
        eat(")");
        const f = FUNCS[tk.v.toLowerCase()];
        return get => f(...args.map(a => a(get)));
      }
      return varRef(tk.v);
    }
    if (tk.v === "(") { const e = expr(); eat(")"); return e; }
    if (tk.v === "-") { const e = power(); return get => -e(get); }
    if (tk.v === "+") return unary();
    throw new Error(`Unexpected "${tk.v}".`);
  }
  function unary() { return primary(); }
  function power() {
    const b = unary();
    if (peek()?.v === "^") { p++; const e = unaryPow(); return get => b(get) ** e(get); }
    return b;
  }
  function unaryPow() { if (peek()?.v === "-") { p++; const e = power(); return get => -e(get); } return power(); }
  function term() {
    let l = power();
    while (peek()?.v === "*" || peek()?.v === "/") {
      const op = toks[p++].v, r = power(), a = l;
      l = op === "*" ? get => a(get) * r(get) : get => a(get) / r(get);
    }
    return l;
  }
  function expr() {
    let l = term();
    while (peek()?.v === "+" || peek()?.v === "-") {
      const op = toks[p++].v, r = term(), a = l;
      l = op === "+" ? get => a(get) + r(get) : get => a(get) - r(get);
    }
    return l;
  }
  if (!toks.length) throw new Error("Type a formula.");
  const fn = expr();
  if (p < toks.length) throw new Error(`Unexpected "${toks[p].v}".`);
  return { fn, used: [...used] };
}

// Labels for groups made from cut-offs. cuts are lower bounds of each group after the first.
export function cutLabels(cuts, integer) {
  const c = [...cuts].sort((a, b) => a - b), out = [`< ${c[0]}`];
  for (let i = 0; i < c.length - 1; i++) out.push(integer ? `${c[i]}–${c[i + 1] - 1}` : `${c[i]} to < ${c[i + 1]}`);
  out.push(`≥ ${c[c.length - 1]}`);
  return out;
}

const fmtNum = x => (Number.isFinite(x) ? String(+x.toPrecision(12)) : "");

export const STEP_TEXT = {
  recode: st => `${st.name}: merged categories of ${st.source}`,
  cut: st => `${st.name}: ${st.source} grouped at ${st.cuts.join(", ")}`,
  compute: st => `${st.name} = ${st.formula}`,
  filter: st => `Filter: ${st.conds.map(c => `${c.v} ${c.op} ${c.value}`).join(" AND ")}`,
};

// Apply steps. Returns { aoa (header first), errors: [{i, msg}], filter: {kept, total} | null }
export function applySteps(aoa, headerRow, missingCodes, steps) {
  let table = aoa.slice(headerRow);
  const errors = [];
  let filter = null;
  const total = table.length - 1;
  steps.forEach((st, i) => {
    try {
      const ds = buildDataset(table, { headerRow: 0, missingCodes });
      const [header, ...rows] = table;
      if (st.type === "filter") {
        const tests = st.conds.map(c => {
          const v = ds.byName[c.v]; if (!v) throw new Error(`"${c.v}" no longer exists.`);
          const numOps = { ">": (a, b) => a > b, "≥": (a, b) => a >= b, "<": (a, b) => a < b, "≤": (a, b) => a <= b, "=": (a, b) => a === b, "≠": (a, b) => a !== b };
          if (c.op === "is" || c.op === "is not") {
            const want = String(c.value).toLowerCase();
            return r => { const x = ds.cat(r, c.v); if (x == null) return false; return (x.toLowerCase() === want) === (c.op === "is"); };
          }
          const b = toNumber(c.value);
          if (!Number.isFinite(b)) throw new Error(`"${c.value}" is not a number.`);
          return r => { const x = ds.num(r, c.v); return Number.isFinite(x) && numOps[c.op](x, b); };
        });
        const kept = ds.rows.filter(r => tests.every(t => t(r)));
        if (!kept.length) throw new Error("No rows match this filter.");
        table = [header, ...kept];
        filter = { kept: kept.length, total, text: STEP_TEXT.filter(st) };
        return;
      }
      if (!st.name?.trim()) throw new Error("Give the new variable a name.");
      if (header.includes(st.name.trim())) throw new Error(`A variable called "${st.name}" already exists.`);
      let col;
      if (st.type === "recode") {
        if (!ds.byName[st.source]) throw new Error(`"${st.source}" no longer exists.`);
        col = ds.rows.map(r => { const x = ds.cat(r, st.source); if (x == null) return ""; const to = st.map[x]; return to == null ? x : String(to).trim(); });
      } else if (st.type === "cut") {
        if (!ds.byName[st.source]) throw new Error(`"${st.source}" no longer exists.`);
        const cuts = [...st.cuts].sort((a, b) => a - b);
        const integer = cuts.every(Number.isInteger) && ds.rows.every(r => { const x = ds.num(r, st.source); return !Number.isFinite(x) || Number.isInteger(x); });
        const labels = cutLabels(cuts, integer);
        col = ds.rows.map(r => { const x = ds.num(r, st.source); if (!Number.isFinite(x)) return ""; let k = 0; while (k < cuts.length && x >= cuts[k]) k++; return labels[k]; });
      } else if (st.type === "compute") {
        const { fn } = parseFormula(st.formula, ds.names);
        col = ds.rows.map(r => fmtNum(fn(n => ds.num(r, n))));
      }
      table = [[...header, st.name.trim()], ...rows.map((r, j) => [...r, col[j]])];
    } catch (e) { errors.push({ i, msg: e.message }); }
  });
  return { aoa: table, errors, filter };
}
