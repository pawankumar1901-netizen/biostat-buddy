// Biostat Buddy — statistics engine (pure functions, no UI).
// Every test here is checked against SciPy / statsmodels in tests/stats.test.mjs.

// ── Basic summaries ──────────────────────────────────────────────────────────
export const sum = a => { let s = 0; for (const v of a) s += v; return s; };
export const mean = a => (a.length ? sum(a) / a.length : NaN);
export function variance(a) {
  const n = a.length; if (n < 2) return NaN;
  const m = mean(a); let s = 0; for (const v of a) s += (v - m) ** 2;
  return s / (n - 1);
}
export const sd = a => Math.sqrt(variance(a));
export function minMax(a) {
  let lo = Infinity, hi = -Infinity;
  for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
}
const sortNum = a => [...a].sort((x, y) => x - y);
// Percentile, SPSS "weighted average" definition (same as SPSS Explore / Frequencies).
export function quantileSorted(s, p) {
  const n = s.length; if (!n) return NaN;
  const h = (n + 1) * p;
  if (h <= 1) return s[0];
  if (h >= n) return s[n - 1];
  const lo = Math.floor(h);
  return s[lo - 1] + (h - lo) * (s[lo] - s[lo - 1]);
}
export function median(a) {
  const s = sortNum(a), n = s.length; if (!n) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

// ── Special functions ────────────────────────────────────────────────────────
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
// log-gamma computed in log space, so it never overflows (the old version did for n > ~340).
export function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
const TINY = 1e-300;
// Regularised incomplete gamma. Returns [P, Q] = [lower, upper] computed so the smaller tail stays precise.
function incGamma(a, x) {
  if (x <= 0) return [0, 1];
  const lnPre = -x + a * Math.log(x) - lgamma(a);
  if (x < a + 1) {
    let ap = a, del = 1 / a, s = del;
    for (let i = 0; i < 10000; i++) { ap++; del *= x / ap; s += del; if (Math.abs(del) < Math.abs(s) * 1e-16) break; }
    const P = Math.min(1, s * Math.exp(lnPre));
    return [P, 1 - P];
  }
  let b = x + 1 - a, c = 1 / TINY, d = 1 / b, h = d;
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a); b += 2;
    d = an * d + b; if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  const Q = Math.max(0, Math.exp(lnPre) * h);
  return [1 - Q, Q];
}
function betacf(a, b, x) {
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < TINY) d = TINY; d = 1 / d; let h = d;
  for (let m = 1; m <= 10000; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return h;
}
// Regularised incomplete beta I_x(a, b)
export function betai(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbt = lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  if (x < (a + 1) / (a + b + 2)) return Math.exp(lbt) * betacf(a, b, x) / a;
  return 1 - Math.exp(lbt) * betacf(b, a, 1 - x) / b;
}

// ── Distributions (upper tails computed directly for small p-values) ─────────
export const pT2 = (t, df) => (Number.isFinite(t) ? betai(df / 2, 0.5, df / (df + t * t)) : 0); // two-sided
export const tCDF = (t, df) => (t >= 0 ? 1 - 0.5 * pT2(t, df) : 0.5 * pT2(t, df));
export const pChi = (x, k) => (x <= 0 ? 1 : incGamma(k / 2, x / 2)[1]);               // upper tail
export const chiCDF = (x, k) => (x <= 0 ? 0 : incGamma(k / 2, x / 2)[0]);
export const pF = (F, d1, d2) => (F <= 0 ? 1 : !Number.isFinite(F) ? 0 : betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * F)));
export const fCDF = (F, d1, d2) => 1 - pF(F, d1, d2);
export const pNorm2 = z => (Number.isFinite(z) ? incGamma(0.5, z * z / 2)[1] : 0);      // two-sided
export function normCDF(z) {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  const [P, Q] = incGamma(0.5, z * z / 2);
  return z >= 0 ? 0.5 + 0.5 * P : 0.5 * Q;
}
// Inverse normal (Acklam) + one Halley refinement step.
export function normInv(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425; let x;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p <= 1 - pl) { const q = p - 0.5, r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  else { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const e = normCDF(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
  return x - u / (1 + x * u / 2);
}
// Quantile of the t distribution (e.g. tInv(0.975, df) for a 95% CI).
export function tInv(p, df) {
  if (!(df > 0)) return NaN;
  if (p === 0.5) return 0;
  if (p < 0.5) return -tInv(1 - p, df);
  let lo = 0, hi = 2;
  while (tCDF(hi, df) < p && hi < 1e8) hi *= 2;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (tCDF(mid, df) < p) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
const Z975 = normInv(0.975);
const lchoose = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);

// ── Ranks ────────────────────────────────────────────────────────────────────
export function rankData(vals) {
  const idx = vals.map((_, i) => i).sort((i, j) => vals[i] - vals[j]);
  const ranks = new Array(vals.length), ties = [];
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && vals[idx[j + 1]] === vals[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k]] = avg;
    if (j > i) ties.push(j - i + 1);
    i = j + 1;
  }
  return { ranks, ties };
}
const tieSum = ties => ties.reduce((s, t) => s + t ** 3 - t, 0);

// ── Shapiro-Wilk (Royston 1995, algorithm AS R94 — same as SPSS / R / SciPy) ─
function poly(cc, x) { let r = 0; for (let i = cc.length - 1; i >= 0; i--) r = r * x + cc[i]; return r; }
export function shapiroWilk(values) {
  const x = sortNum(values), n = x.length;
  if (n < 3 || n > 5000) return null;
  const [lo, hi] = [x[0], x[n - 1]];
  if (hi - lo < 1e-12 * Math.max(1, Math.abs(hi))) return null;
  const nn2 = Math.floor(n / 2), a = new Array(nn2);
  if (n === 3) a[0] = Math.SQRT1_2;
  else {
    const an25 = n + 0.25, m = new Array(nn2);
    let summ2 = 0;
    for (let i = 0; i < nn2; i++) { m[i] = normInv((i + 1 - 0.375) / an25); summ2 += m[i] * m[i]; }
    summ2 *= 2;
    const ssumm2 = Math.sqrt(summ2), rsn = 1 / Math.sqrt(n);
    const c1 = [0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056];
    const c2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];
    const a1 = poly(c1, rsn) - m[0] / ssumm2;
    let i1, fac;
    if (n > 5) {
      i1 = 2;
      const a2 = -m[1] / ssumm2 + poly(c2, rsn);
      fac = Math.sqrt((summ2 - 2 * m[0] ** 2 - 2 * m[1] ** 2) / (1 - 2 * a1 ** 2 - 2 * a2 ** 2));
      a[1] = a2;
    } else {
      i1 = 1;
      fac = Math.sqrt((summ2 - 2 * m[0] ** 2) / (1 - 2 * a1 ** 2));
    }
    a[0] = a1;
    for (let i = i1; i < nn2; i++) a[i] = -m[i] / fac;
  }
  const xm = mean(x);
  let ssq = 0; for (const v of x) ssq += (v - xm) ** 2;
  let num = 0; for (let i = 0; i < nn2; i++) num += a[i] * (x[n - 1 - i] - x[i]);
  let w = Math.min(1, (num * num) / ssq);
  let p;
  if (n === 3) {
    p = Math.max(0, (6 / Math.PI) * (Math.asin(Math.sqrt(w)) - Math.PI / 3));
  } else {
    let w1 = Math.log(1 - w);
    const xx = Math.log(n);
    let mu, s;
    if (n <= 11) {
      const gamma = -2.273 + 0.459 * n;
      if (w1 >= gamma) return { W: w, p: 1e-99 };
      w1 = -Math.log(gamma - w1);
      mu = poly([0.544, -0.39978, 0.025054, -6.714e-4], n);
      s = Math.exp(poly([1.3822, -0.77857, 0.062767, -0.0020322], n));
    } else {
      mu = poly([-1.5861, -0.31082, -0.083751, 0.0038915], xx);
      s = Math.exp(poly([-0.4803, -0.082676, 0.0030302], xx));
    }
    p = 1 - normCDF((w1 - mu) / s);
  }
  return { W: w, p: Math.min(1, Math.max(0, p)) };
}

// ── Descriptive ──────────────────────────────────────────────────────────────
export function describe(values) {
  const n = values.length;
  if (n === 0) throw new Error("No valid values to describe.");
  const s = sortNum(values), m = mean(s), sdev = sd(s);
  const se = sdev / Math.sqrt(n), tcrit = n > 1 ? tInv(0.975, n - 1) : NaN;
  let m2 = 0, m3 = 0, m4 = 0;
  for (const v of s) { const d = v - m; m2 += d * d; m3 += d ** 3; m4 += d ** 4; }
  m2 /= n; m3 /= n; m4 /= n;
  const skew = n > 2 && m2 > 0 ? (Math.sqrt(n * (n - 1)) / (n - 2)) * (m3 / m2 ** 1.5) : NaN;
  const kurt = n > 3 && m2 > 0 ? ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * (m4 / m2 ** 2 - 3) + 6) : NaN;
  const q1 = quantileSorted(s, 0.25), q3 = quantileSorted(s, 0.75);
  return {
    n, mean: m, sd: sdev, se, ciLow: m - tcrit * se, ciHigh: m + tcrit * se,
    median: median(s), q1, q3, iqr: q3 - q1, min: s[0], max: s[n - 1],
    skew, kurt, shapiro: shapiroWilk(s),
  };
}
export function histogram(values) {
  const s = sortNum(values), n = s.length;
  const uniq = [...new Set(s)];
  if (uniq.length <= 15 && uniq.every(Number.isInteger)) {
    return uniq.map(u => ({ label: String(u), count: s.filter(v => v === u).length }));
  }
  const k = Math.min(15, Math.max(5, Math.ceil(Math.log2(n) + 1)));
  const [lo, hi] = [s[0], s[n - 1]];
  const raw = (hi - lo) / k, mag = 10 ** Math.floor(Math.log10(raw || 1));
  const width = [1, 2, 2.5, 5, 10].map(f => f * mag).find(w => w >= raw) || raw;
  const start = Math.floor(lo / width) * width;
  const bins = [];
  for (let b = start; b <= hi + 1e-12; b += width) bins.push({ from: b, to: b + width, count: 0 });
  for (const v of s) { const i = Math.min(bins.length - 1, Math.floor((v - start) / width + 1e-9)); bins[i].count++; }
  const dec = Math.max(0, -Math.floor(Math.log10(width)) + (width / mag === 2.5 ? 1 : 0));
  return bins.map(b => ({ label: `${b.from.toFixed(dec)}–${b.to.toFixed(dec)}`, count: b.count }));
}

// ── Contingency tables ───────────────────────────────────────────────────────
export function fisherExact2x2(a, b, c, d) {
  const r1 = a + b, r2 = c + d, c1 = a + c, n = r1 + r2;
  const lp = k => lchoose(r1, k) + lchoose(r2, c1 - k) - lchoose(n, c1);
  const kmin = Math.max(0, c1 - r2), kmax = Math.min(r1, c1);
  const pObs = lp(a);
  let p = 0;
  for (let k = kmin; k <= kmax; k++) { const v = lp(k); if (v <= pObs + 1e-7) p += Math.exp(v); }
  return Math.min(1, p);
}
export function chiSquareTable(obs) {
  const R = obs.length, C = obs[0].length;
  const rowT = obs.map(r => sum(r)), colT = obs[0].map((_, j) => sum(obs.map(r => r[j])));
  const n = sum(rowT);
  if (R < 2 || C < 2) throw new Error("Each variable needs at least 2 categories with data.");
  const expected = obs.map((r, i) => r.map((_, j) => rowT[i] * colT[j] / n));
  let chi2 = 0, small = 0, minExp = Infinity;
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
    const e = expected[i][j];
    if (e < 5) small++;
    if (e < minExp) minExp = e;
    if (e > 0) chi2 += (obs[i][j] - e) ** 2 / e;
  }
  const df = (R - 1) * (C - 1);
  const res = {
    chi2, df, p: pChi(chi2, df), n, rowT, colT, expected, minExpected: minExp,
    smallCells: small, pctSmall: (100 * small) / (R * C),
    cramersV: Math.sqrt(chi2 / (n * Math.min(R - 1, C - 1))),
  };
  if (R === 2 && C === 2) {
    const [[a, b], [c, d]] = obs;
    const yates = n * Math.max(0, Math.abs(a * d - b * c) - n / 2) ** 2 / (rowT[0] * rowT[1] * colT[0] * colT[1]);
    res.yates = { chi2: yates, p: pChi(yates, 1) };
    res.fisherP = fisherExact2x2(a, b, c, d);
  }
  return res;
}
// a = exposed & event, b = exposed & no event, c = unexposed & event, d = unexposed & no event
export function twoByTwo(a, b, c, d) {
  const corrected = [a, b, c, d].some(v => v === 0);
  const [A, B, Cc, D] = corrected ? [a, b, c, d].map(v => v + 0.5) : [a, b, c, d];
  const or = (A * D) / (B * Cc), seOR = Math.sqrt(1 / A + 1 / B + 1 / Cc + 1 / D);
  const r1 = A / (A + B), r0 = Cc / (Cc + D), rr = r1 / r0;
  const seRR = Math.sqrt(1 / A - 1 / (A + B) + 1 / Cc - 1 / (Cc + D));
  const re = a / (a + b), ru = c / (c + d), rd = re - ru;
  const seRD = Math.sqrt(re * (1 - re) / (a + b) + ru * (1 - ru) / (c + d));
  return {
    corrected,
    or, orLo: Math.exp(Math.log(or) - Z975 * seOR), orHi: Math.exp(Math.log(or) + Z975 * seOR),
    rr, rrLo: Math.exp(Math.log(rr) - Z975 * seRR), rrHi: Math.exp(Math.log(rr) + Z975 * seRR),
    riskExp: re, riskUnexp: ru, rd, rdLo: rd - Z975 * seRD, rdHi: rd + Z975 * seRD,
    afe: rr > 1 ? (rr - 1) / rr : NaN,
  };
}
export function mcnemar(a, b, c, d) {
  // a: yes→yes, b: yes→no, c: no→yes, d: no→no (before rows, after columns)
  const disc = b + c;
  const chi2 = disc > 0 ? (Math.abs(b - c) - 1) ** 2 / disc : 0;
  let pExact = 1;
  if (disc > 0) {
    const k = Math.min(b, c); let cum = 0;
    for (let i = 0; i <= k; i++) cum += Math.exp(lchoose(disc, i) - disc * Math.LN2);
    pExact = Math.min(1, 2 * cum);
  }
  return { b, c, chi2, pChi: disc > 0 ? pChi(chi2, 1) : 1, pExact, n: a + b + c + d };
}

// ── Comparing means ──────────────────────────────────────────────────────────
export function levene(groups) {
  // Mean-centred Levene test (as reported by SPSS)
  const z = groups.map(g => { const m = mean(g); return g.map(v => Math.abs(v - m)); });
  const a = anovaCore(z);
  return { F: a.F, df1: a.dfB, df2: a.dfW, p: a.p };
}
function anovaCore(groups) {
  const all = groups.flat(), N = all.length, k = groups.length, gm = mean(all);
  let SSB = 0, SSW = 0;
  for (const g of groups) { const m = mean(g); SSB += g.length * (m - gm) ** 2; for (const v of g) SSW += (v - m) ** 2; }
  const dfB = k - 1, dfW = N - k, MSB = SSB / dfB, MSW = SSW / dfW;
  const F = MSW > 0 ? MSB / MSW : (MSB > 0 ? Infinity : NaN);
  return { SSB, SSW, dfB, dfW, MSB, MSW, F, p: Number.isNaN(F) ? 1 : pF(F, dfB, dfW), N, k };
}
export function independentT(g1, g2) {
  const n1 = g1.length, n2 = g2.length;
  if (n1 < 2 || n2 < 2) throw new Error("Each group needs at least 2 values.");
  const m1 = mean(g1), m2 = mean(g2), v1 = variance(g1), v2 = variance(g2);
  if (v1 === 0 && v2 === 0) throw new Error("Both groups have identical values (no variation), so a t-test is not possible.");
  const diff = m1 - m2;
  const dfS = n1 + n2 - 2, sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / dfS, seS = Math.sqrt(sp2 * (1 / n1 + 1 / n2));
  const tS = diff / seS, crS = tInv(0.975, dfS);
  const seW = Math.sqrt(v1 / n1 + v2 / n2), tW = diff / seW;
  const dfW = (v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
  const crW = tInv(0.975, dfW);
  return {
    n1, n2, m1, m2, sd1: Math.sqrt(v1), sd2: Math.sqrt(v2), diff,
    student: { t: tS, df: dfS, p: pT2(tS, dfS), lo: diff - crS * seS, hi: diff + crS * seS },
    welch: { t: tW, df: dfW, p: pT2(tW, dfW), lo: diff - crW * seW, hi: diff + crW * seW },
    cohenD: diff / Math.sqrt(sp2), levene: levene([g1, g2]),
  };
}
export function oneWayAnova(groups) {
  if (groups.length < 2) throw new Error("ANOVA needs at least 2 groups.");
  groups.forEach(g => { if (g.length < 2) throw new Error("Every group needs at least 2 values."); });
  const a = anovaCore(groups);
  const k = groups.length, nPairs = (k * (k - 1)) / 2, pairs = [];
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
    const d = mean(groups[i]) - mean(groups[j]);
    const se = Math.sqrt(a.MSW * (1 / groups[i].length + 1 / groups[j].length));
    const t = d / se, cr = tInv(1 - 0.025 / nPairs, a.dfW);
    pairs.push({ i, j, diff: d, p: Math.min(1, pT2(t, a.dfW) * nPairs), lo: d - cr * se, hi: d + cr * se });
  }
  return { ...a, eta2: a.SSB / (a.SSB + a.SSW), levene: levene(groups), pairs };
}
export function pairedT(x, y) {
  const d = x.map((v, i) => v - y[i]), n = d.length;
  if (n < 2) throw new Error("Need at least 2 complete pairs.");
  const md = mean(d), sdd = sd(d);
  if (!(sdd > 0)) throw new Error("All before–after differences are identical, so a paired t-test is not possible.");
  const se = sdd / Math.sqrt(n), t = md / se, df = n - 1, cr = tInv(0.975, df);
  return { n, meanDiff: md, sdDiff: sdd, t, df, p: pT2(t, df), lo: md - cr * se, hi: md + cr * se, dz: md / sdd, shapiroDiff: shapiroWilk(d) };
}

// ── Non-parametric ───────────────────────────────────────────────────────────
function exactUcdf(n1, n2) {
  // f[i][j][u]: number of arrangements with U = u for sample sizes i, j
  let prev = Array.from({ length: n2 + 1 }, () => [1]);
  for (let i = 1; i <= n1; i++) {
    const cur = [[1]];
    for (let j = 1; j <= n2; j++) {
      const arr = new Array(i * j + 1).fill(0), up = prev[j], left = cur[j - 1];
      for (let u = 0; u < arr.length; u++) arr[u] = (u - j >= 0 && u - j < up.length ? up[u - j] : 0) + (u < left.length ? left[u] : 0);
      cur.push(arr);
    }
    prev = cur;
  }
  const f = prev[n2], total = sum(f), cdf = []; let c = 0;
  for (const v of f) { c += v; cdf.push(c / total); }
  return cdf;
}
export function mannWhitney(g1, g2) {
  const n1 = g1.length, n2 = g2.length, N = n1 + n2;
  if (n1 < 1 || n2 < 1) throw new Error("Each group needs at least 1 value.");
  const { ranks, ties } = rankData([...g1, ...g2]);
  const R1 = sum(ranks.slice(0, n1)), U1 = R1 - (n1 * (n1 + 1)) / 2, U2 = n1 * n2 - U1;
  const sigma = Math.sqrt((n1 * n2 / 12) * ((N + 1) - tieSum(ties) / (N * (N - 1))));
  const z = sigma > 0 ? (U1 - n1 * n2 / 2) / sigma : 0;
  let p = pNorm2(z), method = "asymptotic";
  if (ties.length === 0 && N <= 30) {
    const cdf = exactUcdf(n1, n2), u = Math.round(Math.min(U1, U2));
    p = Math.min(1, 2 * cdf[u]); method = "exact";
  }
  return {
    n1, n2, U: Math.min(U1, U2), U1, z, p, method,
    meanRank1: R1 / n1, meanRank2: (sum(ranks) - R1) / n2, r: Math.abs(z) / Math.sqrt(N),
  };
}
export function kruskalWallis(groups) {
  const k = groups.length;
  if (k < 2) throw new Error("Kruskal-Wallis needs at least 2 groups.");
  const all = groups.flat(), N = all.length, { ranks, ties } = rankData(all);
  let off = 0; const R = [];
  for (const g of groups) { R.push(sum(ranks.slice(off, off + g.length))); off += g.length; }
  let H = (12 / (N * (N + 1))) * sum(R.map((r, i) => (r * r) / groups[i].length)) - 3 * (N + 1);
  const C = 1 - tieSum(ties) / (N ** 3 - N);
  if (C > 0) H /= C;
  const df = k - 1, nPairs = (k * (k - 1)) / 2, pairs = [];
  const base = (N * (N + 1)) / 12 - tieSum(ties) / (12 * (N - 1));
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
    const z = (R[i] / groups[i].length - R[j] / groups[j].length) / Math.sqrt(base * (1 / groups[i].length + 1 / groups[j].length));
    pairs.push({ i, j, z, p: Math.min(1, pNorm2(z) * nPairs) });
  }
  return { H, df, p: pChi(H, df), N, meanRanks: R.map((r, i) => r / groups[i].length), epsilon2: H / (N - 1), pairs };
}
function exactSignedRankCdf(n) {
  const max = (n * (n + 1)) / 2, f = new Array(max + 1).fill(0); f[0] = 1;
  for (let k = 1; k <= n; k++) for (let s = max; s >= k; s--) f[s] += f[s - k];
  const total = 2 ** n, cdf = []; let c = 0;
  for (const v of f) { c += v; cdf.push(c / total); }
  return cdf;
}
export function wilcoxonSignedRank(x, y) {
  const all = x.map((v, i) => v - y[i]);
  const d = all.filter(v => v !== 0), n = d.length;
  if (n < 1) throw new Error("All differences are zero, so the Wilcoxon test is not possible.");
  const { ranks, ties } = rankData(d.map(Math.abs));
  let Wp = 0, Wm = 0, nPos = 0, nNeg = 0;
  d.forEach((v, i) => { if (v > 0) { Wp += ranks[i]; nPos++; } else { Wm += ranks[i]; nNeg++; } });
  const mu = (n * (n + 1)) / 4, varW = (n * (n + 1) * (2 * n + 1)) / 24 - tieSum(ties) / 48;
  const z = varW > 0 ? (Math.min(Wp, Wm) - mu) / Math.sqrt(varW) : 0;
  let p = pNorm2(z), method = "asymptotic";
  if (ties.length === 0 && n <= 25) {
    const cdf = exactSignedRankCdf(n);
    p = Math.min(1, 2 * cdf[Math.round(Math.min(Wp, Wm))]); method = "exact";
  }
  return { n, nZero: all.length - n, nPos, nNeg, Wplus: Wp, Wminus: Wm, T: Math.min(Wp, Wm), z, p, method, r: Math.abs(z) / Math.sqrt(n), medianDiff: median(all) };
}

// ── Correlation ──────────────────────────────────────────────────────────────
export function pearson(x, y) {
  const n = x.length;
  if (n < 3) throw new Error("Correlation needs at least 3 complete pairs.");
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  if (sxx === 0 || syy === 0) throw new Error("One variable has the same value for everyone, so correlation is undefined.");
  const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
  const df = n - 2, t = Math.abs(r) >= 1 ? Infinity : r * Math.sqrt(df / (1 - r * r));
  let lo = NaN, hi = NaN;
  if (n > 3 && Math.abs(r) < 1) { const z = Math.atanh(r), se = 1 / Math.sqrt(n - 3); lo = Math.tanh(z - Z975 * se); hi = Math.tanh(z + Z975 * se); }
  const slope = sxy / sxx;
  return { r, n, t, df, p: pT2(t, df), lo, hi, slope, intercept: my - slope * mx };
}
export function spearman(x, y) {
  const n = x.length;
  if (n < 3) throw new Error("Correlation needs at least 3 complete pairs.");
  const res = pearson(rankData(x).ranks, rankData(y).ranks);
  return { rho: res.r, n, t: res.t, df: res.df, p: res.p };
}

// ── Matrix helpers ───────────────────────────────────────────────────────────
function matInverse(A) {
  const n = A.length, M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  const scale = Math.max(...A.map(r => Math.max(...r.map(Math.abs)))) || 1;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-11 * scale) throw new Error("SINGULAR");
    [M[c], M[piv]] = [M[piv], M[c]];
    const div = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= div;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map(r => r.slice(n));
}
// Standardise predictors for numerical stability; returns design + back-transform matrix.
function standardise(X, names) {
  const n = X.length, p = names.length, means = [], sds = [];
  for (let j = 0; j < p; j++) {
    const col = X.map(r => r[j]), s = sd(col);
    if (!(s > 0)) throw new Error(`"${names[j]}" has the same value for everyone in the analysed rows, so it cannot be a predictor.`);
    means.push(mean(col)); sds.push(s);
  }
  const Z = X.map(r => [1, ...r.map((v, j) => (v - means[j]) / sds[j])]);
  const T = Array.from({ length: p + 1 }, (_, i) => Array.from({ length: p + 1 }, (_, j) => {
    if (i === 0) return j === 0 ? 1 : -means[j - 1] / sds[j - 1];
    return i === j ? 1 / sds[i - 1] : 0;
  }));
  return { Z, T, n, p };
}
const mulMV = (M, v) => M.map(r => r.reduce((s, x, j) => s + x * v[j], 0));
function sandwich(T, V) { // T V Tᵀ
  const p = T.length, TV = T.map(r => Array.from({ length: p }, (_, j) => r.reduce((s, x, k) => s + x * V[k][j], 0)));
  return TV.map(r => Array.from({ length: p }, (_, j) => r.reduce((s, x, k) => s + x * T[j][k], 0)));
}
function xtwx(Z, w) {
  const p = Z[0].length, H = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < Z.length; i++) { const zi = Z[i], wi = w ? w[i] : 1; for (let a = 0; a < p; a++) { const v = zi[a] * wi; for (let b = a; b < p; b++) H[a][b] += v * zi[b]; } }
  for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) H[a][b] = H[b][a];
  return H;
}
const COLLINEAR = "Two or more predictors carry the same information (collinear), for example a variable and its own copy, or dummy categories that add up. Remove one and try again.";

// ── Linear regression (OLS) ──────────────────────────────────────────────────
export function linearRegression(X, y, names) {
  const n = y.length, p = names.length;
  if (n < p + 2) throw new Error(`Too few complete rows (${n}) for ${p} predictor term(s).`);
  const { Z, T } = standardise(X, names);
  let inv;
  try { inv = matInverse(xtwx(Z)); } catch { throw new Error(COLLINEAR); }
  const Zty = Z[0].map((_, j) => Z.reduce((s, r, i) => s + r[j] * y[i], 0));
  const theta = mulMV(inv, Zty), beta = mulMV(T, theta);
  const fitted = Z.map(r => r.reduce((s, v, j) => s + v * theta[j], 0));
  const SSE = sum(y.map((v, i) => (v - fitted[i]) ** 2)), my = mean(y), SST = sum(y.map(v => (v - my) ** 2));
  const df = n - p - 1, s2 = SSE / df, V = sandwich(T, inv.map(r => r.map(v => v * s2))), cr = tInv(0.975, df);
  const coefs = ["(Constant)", ...names].map((name, i) => {
    const se = Math.sqrt(Math.max(0, V[i][i])), t = beta[i] / se;
    return { name, b: beta[i], se, t, p: pT2(t, df), lo: beta[i] - cr * se, hi: beta[i] + cr * se };
  });
  const R2 = SST > 0 ? 1 - SSE / SST : NaN, F = ((SST - SSE) / p) / s2;
  return { n, p, df, coefs, R2, adjR2: 1 - (1 - R2) * (n - 1) / df, F, dfModel: p, pModel: pF(F, p, df), rmse: Math.sqrt(s2), fitted };
}

// ── Binary logistic regression (Newton-Raphson / IRLS) ───────────────────────
const sigmoid = z => 1 / (1 + Math.exp(-Math.max(-700, Math.min(700, z))));
export function logisticRegression(X, y, names) {
  const n = y.length, p = names.length;
  if (n < p + 2) throw new Error(`Too few complete rows (${n}) for ${p} predictor term(s).`);
  const { Z, T } = standardise(X, names);
  let theta = new Array(p + 1).fill(0), converged = false, iter = 0, H;
  for (; iter < 100; iter++) {
    const pr = Z.map(r => sigmoid(r.reduce((s, v, j) => s + v * theta[j], 0)));
    H = xtwx(Z, pr.map(q => Math.max(q * (1 - q), 1e-12)));
    const g = Z[0].map((_, j) => Z.reduce((s, r, i) => s + r[j] * (y[i] - pr[i]), 0));
    let Hinv;
    try { Hinv = matInverse(H); } catch { throw new Error(COLLINEAR); }
    const step = mulMV(Hinv, g);
    theta = theta.map((t, j) => t + step[j]);
    if (Math.max(...step.map(Math.abs)) < 1e-9) { converged = true; break; }
  }
  const prob = Z.map(r => sigmoid(r.reduce((s, v, j) => s + v * theta[j], 0)));
  H = xtwx(Z, prob.map(q => Math.max(q * (1 - q), 1e-12)));
  let Vstd = null;
  try { Vstd = matInverse(H); } catch { /* reported as separation below */ }
  const beta = mulMV(T, theta), V = Vstd ? sandwich(T, Vstd) : null;
  const ll = sum(y.map((v, i) => (v ? Math.log(Math.max(prob[i], 1e-300)) : Math.log(Math.max(1 - prob[i], 1e-300)))));
  const p0 = mean(y), ll0 = n * (p0 * Math.log(p0) + (1 - p0) * Math.log(1 - p0));
  const lr = 2 * (ll - ll0), coxSnell = 1 - Math.exp((2 * (ll0 - ll)) / n);
  const nagelkerke = coxSnell / (1 - Math.exp((2 * ll0) / n));
  const maxStd = Math.max(...theta.slice(1).map(Math.abs));
  const maxSeStd = Vstd ? Math.max(...Vstd.slice(1).map((r, i) => Math.sqrt(Math.max(0, r[i + 1])))) : Infinity;
  const separation = !converged || maxStd > 12 || maxSeStd > 50;
  const coefs = ["(Constant)", ...names].map((name, i) => {
    const se = V ? Math.sqrt(Math.max(0, V[i][i])) : NaN, wald = (beta[i] / se) ** 2;
    return {
      name, b: beta[i], se, wald, p: Number.isFinite(wald) ? pChi(wald, 1) : NaN,
      or: Math.exp(beta[i]), lo: Math.exp(beta[i] - Z975 * se), hi: Math.exp(beta[i] + Z975 * se),
    };
  });
  const correct = sum(y.map((v, i) => ((prob[i] >= 0.5 ? 1 : 0) === v ? 1 : 0)));
  return {
    n, p, events: sum(y), coefs, ll, ll0, lr, lrDf: p, lrP: pChi(lr, p), coxSnell, nagelkerke,
    hl: hosmerLemeshow(y, prob), accuracy: correct / n, converged, iterations: iter + 1, separation, prob,
  };
}
export function hosmerLemeshow(y, prob) {
  const n = y.length;
  if (n < 20) return null;
  const g = 10, s = y.map((v, i) => ({ v, q: prob[i] })).sort((a, b) => a.q - b.q);
  let chi2 = 0;
  for (let k = 0; k < g; k++) {
    const grp = s.slice(Math.floor((k * n) / g), Math.floor(((k + 1) * n) / g));
    if (!grp.length) continue;
    const o = sum(grp.map(d => d.v)), e = sum(grp.map(d => d.q)), m = grp.length;
    if (e > 0 && e < m) chi2 += (o - e) ** 2 / (e * (1 - e / m));
  }
  return { chi2, df: g - 2, p: pChi(chi2, g - 2) };
}

// ── Quantiles of beta and F (bisection) ──────────────────────────────────────
export function betaInv(p, a, b) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (betai(a, b, mid) < p) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
export function fInv(p, d1, d2) {
  let lo = 0, hi = 1;
  while (fCDF(hi, d1, d2) < p && hi < 1e10) hi *= 2;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (fCDF(mid, d1, d2) < p) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
// Exact (Clopper-Pearson) 95% CI for a proportion x/n
export function exactCI(x, n) {
  if (!n) return [NaN, NaN];
  return [x === 0 ? 0 : betaInv(0.025, x, n - x + 1), x === n ? 1 : betaInv(0.975, x + 1, n - x)];
}

// ── Diagnostic accuracy (2×2: test result vs reference standard) ─────────────
// tp: test+ & disease+, fp: test+ & disease−, fn: test− & disease+, tn: test− & disease−
export function diagnostic(tp, fp, fn, tn) {
  const n = tp + fp + fn + tn, prop = (x, d) => ({ est: d ? x / d : NaN, ci: exactCI(x, d) });
  const sens = prop(tp, tp + fn), spec = prop(tn, tn + fp), ppv = prop(tp, tp + fp), npv = prop(tn, tn + fn);
  const acc = prop(tp + tn, n), prev = prop(tp + fn, n);
  // Likelihood ratios with log-method CIs (Simel et al. 1991)
  const lr = (num, den, se) => { const v = num / den; return { est: v, ci: Number.isFinite(se) ? [Math.exp(Math.log(v) - Z975 * se), Math.exp(Math.log(v) + Z975 * se)] : [NaN, NaN] }; };
  const p1 = tp / (tp + fn), p2 = fp / (fp + tn);
  const lrPos = lr(p1, p2, Math.sqrt((1 - p1) / tp + (1 - p2) / fp));
  const lrNeg = lr(1 - p1, 1 - p2, Math.sqrt(p1 / fn + p2 / tn));
  return { n, sens, spec, ppv, npv, acc, prev, lrPos, lrNeg, youden: sens.est + spec.est - 1 };
}

// ── ROC curve: AUC with DeLong standard error ────────────────────────────────
function midranks(v) { return rankData(v).ranks; }
export function roc(scores, labels) {
  const pos = scores.filter((_, i) => labels[i] === 1), neg = scores.filter((_, i) => labels[i] === 0);
  const n1 = pos.length, n0 = neg.length;
  if (n1 < 2 || n0 < 2) throw new Error("Need at least 2 cases with and 2 without the condition.");
  const all = midranks([...pos, ...neg]), rp = midranks(pos), rn = midranks(neg);
  const v10 = pos.map((_, i) => (all[i] - rp[i]) / n0);
  const v01 = neg.map((_, j) => 1 - (all[n1 + j] - rn[j]) / n1);
  const auc = mean(v10);
  const se = Math.sqrt(variance(v10) / n1 + variance(v01) / n0);
  const z = se > 0 ? (auc - 0.5) / se : Infinity;
  // Coordinates: "positive" when score ≥ threshold
  const th = [...new Set(scores)].sort((a, b) => a - b);
  const pts = [{ t: -Infinity, sens: 1, spec: 0 }];
  for (const t of th) {
    const tp = pos.filter(v => v >= t).length, tn = neg.filter(v => v < t).length;
    pts.push({ t, sens: tp / n1, spec: tn / n0 });
  }
  pts.push({ t: Infinity, sens: 0, spec: 1 });
  const best = pts.slice(1, -1).reduce((b, q) => (q.sens + q.spec - 1 > b.sens + b.spec - 1 ? q : b), pts[1]);
  return { auc, se, lo: Math.max(0, auc - Z975 * se), hi: Math.min(1, auc + Z975 * se), z, p: pNorm2(z), n1, n0, points: pts, best };
}

// ── Cohen's kappa ────────────────────────────────────────────────────────────
export function cohenKappa(table) {
  const k = table.length, n = sum(table.map(r => sum(r)));
  const p = table.map(r => r.map(v => v / n));
  const row = p.map(r => sum(r)), col = p[0].map((_, j) => sum(p.map(r => r[j])));
  const po = sum(p.map((r, i) => r[i])), pe = sum(row.map((r, i) => r * col[i]));
  if (pe >= 1) throw new Error("Both raters used a single category only, so kappa is undefined.");
  const kappa = (po - pe) / (1 - pe);
  let A = 0, B = 0;
  for (let i = 0; i < k; i++) {
    A += p[i][i] * (1 - (row[i] + col[i]) * (1 - kappa)) ** 2;
    for (let j = 0; j < k; j++) if (i !== j) B += p[i][j] * (col[i] + row[j]) ** 2;
  }
  B *= (1 - kappa) ** 2;
  const Cc = (kappa - pe * (1 - kappa)) ** 2;
  const se = Math.sqrt(Math.max(0, A + B - Cc)) / ((1 - pe) * Math.sqrt(n));
  const se0 = Math.sqrt(Math.max(0, pe + pe * pe - sum(row.map((r, i) => r * col[i] * (r + col[i]))))) / ((1 - pe) * Math.sqrt(n));
  const z = kappa / se0;
  return { n, po, pe, kappa, se, se0, lo: kappa - Z975 * se, hi: kappa + Z975 * se, z, p: pNorm2(z) };
}

// ── Cronbach's alpha ─────────────────────────────────────────────────────────
export function cronbach(items) { // items: array of k arrays (complete cases, same length)
  const k = items.length, n = items[0].length;
  if (k < 2) throw new Error("Choose at least 2 items.");
  if (n < 3) throw new Error("Need at least 3 people with answers to every item.");
  const total = items[0].map((_, i) => sum(items.map(it => it[i])));
  const vt = variance(total);
  if (!(vt > 0)) throw new Error("Total scores have no variation, so alpha is undefined.");
  const alphaOf = its => { const tot = its[0].map((_, i) => sum(its.map(it => it[i]))); return (its.length / (its.length - 1)) * (1 - sum(its.map(variance)) / variance(tot)); };
  const alpha = alphaOf(items);
  let rsum = 0, rc = 0;
  for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) { const r = corr(items[a], items[b]); if (Number.isFinite(r)) { rsum += r; rc++; } }
  const rbar = rsum / rc;
  const df1 = n - 1, df2 = (n - 1) * (k - 1);
  const ciLo = 1 - (1 - alpha) * fInv(0.975, df1, df2), ciHi = 1 - (1 - alpha) * fInv(0.025, df1, df2);
  const itemStats = items.map((it, j) => ({
    mean: mean(it), sd: sd(it),
    rCorrected: corr(it, total.map((t, i) => t - it[i])),
    alphaIfDeleted: k > 2 ? alphaOf(items.filter((_, x) => x !== j)) : NaN,
  }));
  return { k, n, alpha, stdAlpha: (k * rbar) / (1 + (k - 1) * rbar), meanInterItemR: rbar, ciLo, ciHi, itemStats, totalMean: mean(total), totalSd: Math.sqrt(vt) };
}
function corr(x, y) {
  const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0;
  for (let i = 0; i < x.length; i++) { const u = x[i] - mx, v = y[i] - my; a += u * v; b += u * u; c += v * v; }
  return a / Math.sqrt(b * c);
}

// ── Chi-square for trend (ordered groups × binary outcome) ───────────────────
export function trendTest(events, totals, scores) {
  const N = sum(totals), R = sum(events), pbar = R / N;
  if (R === 0 || R === N) throw new Error("Everyone has the same outcome, so a trend test is not possible.");
  const xbar = sum(totals.map((n, i) => n * scores[i])) / N;
  const num = sum(totals.map((n, i) => n * (scores[i] - xbar) * (events[i] / n - pbar))) ** 2;
  const den = sum(totals.map((n, i) => n * (scores[i] - xbar) ** 2));
  const chi2 = num / den / (pbar * (1 - pbar));             // Cochran-Armitage (as in R prop.trend.test / Epi Info)
  const linByLin = (chi2 * (N - 1)) / N;                     // Linear-by-linear association (as in SPSS)
  return { chi2, p: pChi(chi2, 1), linByLin, pLinByLin: pChi(linByLin, 1), N, slope: Math.sqrt(num) / den * Math.sign(sum(totals.map((n, i) => n * (scores[i] - xbar) * (events[i] / n - pbar)))) };
}

// ── Kaplan-Meier and log-rank ────────────────────────────────────────────────
export function kaplanMeier(time, event) {
  const idx = time.map((_, i) => i).sort((a, b) => time[a] - time[b]);
  const n = time.length, rows = [];
  let atRisk = n, S = 1, gw = 0, i = 0;
  const times = [], nRisk = [], nEvent = [];
  while (i < n) {
    const t = time[idx[i]]; let d = 0, c = 0;
    while (i < n && time[idx[i]] === t) { if (event[idx[i]]) d++; else c++; i++; }
    if (d > 0) {
      S *= 1 - d / atRisk;
      if (atRisk > d) gw += d / (atRisk * (atRisk - d));
      // log(-log S) ("exponential Greenwood") 95% CI, as in lifelines
      let lo = NaN, hi = NaN;
      if (S > 0 && S < 1) { const se = Math.sqrt(gw) / Math.abs(Math.log(S)); const ll = Math.log(-Math.log(S)); lo = Math.exp(-Math.exp(ll + Z975 * se)); hi = Math.exp(-Math.exp(ll - Z975 * se)); }
      rows.push({ t, atRisk, d, c, S, lo, hi });
    }
    times.push(t); nRisk.push(atRisk); nEvent.push(d);
    atRisk -= d + c;
  }
  const firstBelow = key => { const r = rows.find(q => q[key] <= 0.5); return r ? r.t : NaN; };
  return { n, events: sum(event), rows, median: firstBelow("S"), medianLo: firstBelow("lo"), medianHi: firstBelow("hi"), times, nRisk, nEvent };
}
export function logRank(time, event, group, levels) {
  const g = levels.length, ts = [...new Set(time.filter((_, i) => event[i]))].sort((a, b) => a - b);
  const O = new Array(g).fill(0), E = new Array(g).fill(0), V = Array.from({ length: g }, () => new Array(g).fill(0));
  for (const t of ts) {
    const nAt = levels.map(l => time.filter((x, i) => group[i] === l && x >= t).length);
    const dAt = levels.map(l => time.filter((x, i) => group[i] === l && x === t && event[i]).length);
    const nT = sum(nAt), dT = sum(dAt);
    if (nT < 1) continue;
    for (let a = 0; a < g; a++) {
      O[a] += dAt[a]; E[a] += (dT * nAt[a]) / nT;
      if (nT > 1) for (let b = 0; b < g; b++) V[a][b] += (dT * (nT - dT) / (nT - 1)) * (nAt[a] / nT) * ((a === b ? 1 : 0) - nAt[b] / nT);
    }
  }
  const m = g - 1, diff = O.slice(0, m).map((o, a) => o - E[a]);
  let chi2;
  try { const Vi = matInverse(V.slice(0, m).map(r => r.slice(0, m))); chi2 = sum(diff.map((d, a) => d * sum(diff.map((e, b) => Vi[a][b] * e)))); }
  catch { chi2 = NaN; }
  return { chi2, df: m, p: pChi(chi2, m), O, E };
}
