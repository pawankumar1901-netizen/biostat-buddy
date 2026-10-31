// Number and p-value formatting used everywhere (screen, PDF, Word, AI summary).
export function fmt(x, d = 2) {
  if (x === Infinity) return "∞";
  if (x === -Infinity) return "−∞";
  if (x == null || !Number.isFinite(x)) return "—";
  const s = x.toFixed(d);
  return /^-0\.?0*$/.test(s) ? s.slice(1) : s.replace("-", "−");
}
export const fmtN = x => (Number.isFinite(x) ? String(Math.round(x)) : "—");
export const fmtPct = (x, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)}%` : "—");
export function fmtP(p) {
  if (p == null || !Number.isFinite(p)) return "—";
  if (p < 0.001) return "<0.001";
  return p >= 0.9995 ? "1.000" : p.toFixed(3);
}
export const pText = p => (!Number.isFinite(p) ? "p not available" : p < 0.001 ? "p < 0.001" : `p = ${fmtP(p)}`);
export const pCell = p => ({ t: fmtP(p), sig: Number.isFinite(p) && p < 0.05 });
export const ci = (lo, hi, d = 2) => `${fmt(lo, d)} to ${fmt(hi, d)}`;
export const meanSd = (m, s, d = 2) => `${fmt(m, d)} ± ${fmt(s, d)}`;
export const medIqr = (m, q1, q3, d = 2) => `${fmt(m, d)} (${fmt(q1, d)}–${fmt(q3, d)})`;
export const cellText = c => (c == null ? "" : typeof c === "object" ? c.t ?? "" : String(c));
// Sensible decimals for a variable: more decimals for small-valued data.
export function decimalsFor(values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return 2;
  let mx = 0, allInt = true;
  for (const v of finite) { const a = Math.abs(v); if (a > mx) mx = a; if (!Number.isInteger(v)) allInt = false; }
  if (allInt) return 1;
  return mx >= 100 ? 1 : mx >= 1 ? 2 : 3;
}
