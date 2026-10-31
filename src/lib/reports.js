// Biostat Buddy — test catalogue, input resolution and report building.
import * as S from "./stats.js";
import { numVars, catVars, levelsOf, naturalCompare } from "./data.js";
import { fmt, fmtN, fmtP, fmtPct, pText, pCell, ci, meanSd, medIqr, decimalsFor } from "./format.js";

// ── Catalogue ────────────────────────────────────────────────────────────────
const OUTCOME_NUM = { key: "outcome", label: "Outcome (numeric)", kind: "num" };
const GROUP = { key: "group", label: "Groups (categorical)", kind: "cat" };
const LEVEL_A = { key: "levelA", label: "Group 1", kind: "level", of: "group" };
const LEVEL_B = { key: "levelB", label: "Group 2", kind: "level", of: "group", not: "levelA" };
const BEFORE_NUM = { key: "before", label: "Before / first measurement", kind: "num" };
const AFTER_NUM = { key: "after", label: "After / second measurement", kind: "num", not: "before" };
const PREDICTORS = { key: "predictors", label: "Predictors", kind: "multi", not: "outcome" };

export const TESTS = [
  { id: "describe", group: "Describe", name: "Descriptive statistics", slots: [{ key: "v", label: "Variable", kind: "any" }] },
  { id: "ttest", group: "Compare 2 groups", name: "Independent t-test", slots: [OUTCOME_NUM, GROUP, LEVEL_A, LEVEL_B] },
  { id: "mannwhitney", group: "Compare 2 groups", name: "Mann-Whitney U test", slots: [OUTCOME_NUM, GROUP, LEVEL_A, LEVEL_B] },
  { id: "anova", group: "Compare 3+ groups", name: "One-way ANOVA", slots: [OUTCOME_NUM, GROUP] },
  { id: "kruskal", group: "Compare 3+ groups", name: "Kruskal-Wallis test", slots: [OUTCOME_NUM, GROUP] },
  { id: "pairedt", group: "Before vs after (paired)", name: "Paired t-test", slots: [BEFORE_NUM, AFTER_NUM] },
  { id: "wilcoxon", group: "Before vs after (paired)", name: "Wilcoxon signed-rank test", slots: [BEFORE_NUM, AFTER_NUM] },
  { id: "mcnemar", group: "Before vs after (paired)", name: "McNemar's test", slots: [{ key: "before", label: "Before (yes/no type)", kind: "cat" }, { key: "after", label: "After (same categories)", kind: "cat", not: "before" }] },
  { id: "chisquare", group: "Association", name: "Chi-square test", slots: [{ key: "row", label: "Row variable", kind: "cat" }, { key: "col", label: "Column variable", kind: "cat", not: "row" }] },
  { id: "twobytwo", group: "Association", name: "2×2 table: OR, RR, Fisher", slots: [
    { key: "exposure", label: "Exposure / risk factor", kind: "cat" }, { key: "exposedLevel", label: "Exposed category", kind: "level", of: "exposure", guess: true },
    { key: "outcome", label: "Outcome / disease", kind: "cat", not: "exposure" }, { key: "event", label: "Outcome present category", kind: "level", of: "outcome", guess: true }] },
  { id: "pearson", group: "Correlation", name: "Pearson correlation", slots: [{ key: "x", label: "Variable X", kind: "num" }, { key: "y", label: "Variable Y", kind: "num", not: "x" }] },
  { id: "spearman", group: "Correlation", name: "Spearman correlation", slots: [{ key: "x", label: "Variable X", kind: "num" }, { key: "y", label: "Variable Y", kind: "num", not: "x" }] },
  { id: "linear", group: "Regression", name: "Linear regression", slots: [OUTCOME_NUM, PREDICTORS] },
  { id: "logistic", group: "Regression", name: "Binary logistic regression", slots: [
    { key: "outcome", label: "Outcome (categorical)", kind: "cat" }, { key: "event", label: "Event (coded 1)", kind: "level", of: "outcome", guess: true }, PREDICTORS] },
];
export const testById = id => TESTS.find(t => t.id === id);

const YES_RE = /^(yes|y|1|true|present|positive|pos|case|cases|disease|diseased|exposed|died|dead|death|abnormal|high|smoker|current)$/i;
const guessLevel = levels => levels.find(l => YES_RE.test(l)) ?? levels[levels.length > 1 ? 1 : 0];

// Turn the user's (possibly stale) selections into valid ones for this test and dataset.
export function resolveConfig(testId, cfg, ds) {
  const test = testById(testId), values = {}, options = {};
  const nums = numVars(ds), cats = catVars(ds);
  for (const slot of test.slots) {
    let opts;
    if (slot.kind === "num") opts = nums;
    else if (slot.kind === "cat") opts = cats;
    else if (slot.kind === "any") opts = [...nums, ...cats];
    else if (slot.kind === "level") opts = levelsOf(ds, values[slot.of]);
    else if (slot.kind === "multi") opts = [...nums, ...cats];
    if (slot.not) opts = opts.filter(o => o !== values[slot.not]);
    options[slot.key] = opts;
    const cur = cfg[slot.key];
    if (slot.kind === "multi") values[slot.key] = (Array.isArray(cur) ? cur : []).filter(v => opts.includes(v));
    else if (opts.includes(cur)) values[slot.key] = cur;
    else values[slot.key] = slot.guess ? guessLevel(opts) ?? "" : opts[0] ?? "";
  }
  if (values.predictors) {
    values.refs = {};
    for (const p of values.predictors) {
      if (ds.byName[p]?.type !== "categorical") continue;
      const lv = levelsOf(ds, p);
      values.refs[p] = lv.includes(cfg.refs?.[p]) ? cfg.refs[p] : lv[0];
    }
  }
  return { values, options };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fail = msg => { throw new Error(msg); };
function groupValues(ds, outcome, group, levels) {
  const out = levels.map(() => []);
  for (const r of ds.rows) {
    const g = ds.cat(r, group), y = ds.num(r, outcome);
    const i = levels.indexOf(g);
    if (i >= 0 && Number.isFinite(y)) out[i].push(y);
  }
  return out;
}
function pairs(ds, a, b, kind = "num") {
  const xa = [], xb = []; let dropped = 0;
  for (const r of ds.rows) {
    const u = kind === "num" ? ds.num(r, a) : ds.cat(r, a), v = kind === "num" ? ds.num(r, b) : ds.cat(r, b);
    const ok = kind === "num" ? Number.isFinite(u) && Number.isFinite(v) : u != null && v != null;
    if (ok) { xa.push(u); xb.push(v); } else dropped++;
  }
  return [xa, xb, dropped];
}
function normalityNote(label, sw) {
  if (!sw) return null;
  return sw.p < 0.05 ? `${label}: Shapiro-Wilk ${pText(sw.p)} — not normally distributed` : null;
}
const strength = r => { const a = Math.abs(r); return a < 0.1 ? "negligible" : a < 0.4 ? "weak" : a < 0.7 ? "moderate" : a < 0.9 ? "strong" : "very strong"; };
const sig = p => p < 0.05;
const droppedWarn = (n, what = "rows") => (n > 0 ? `${n} ${what} with missing values were excluded.` : null);
function crosstab(ds, a, b, la, lb) {
  const t = la.map(() => lb.map(() => 0)); let n = 0;
  for (const r of ds.rows) {
    const i = la.indexOf(ds.cat(r, a)), j = lb.indexOf(ds.cat(r, b));
    if (i >= 0 && j >= 0) { t[i][j]++; n++; }
  }
  return { t, n };
}
function presentLevels(ds, name, other) {
  const set = new Set();
  for (const r of ds.rows) { const c = ds.cat(r, name); if (c != null && (!other || ds.cat(r, other) != null)) set.add(c); }
  return [...set].sort(naturalCompare);
}

// ── Build one report ─────────────────────────────────────────────────────────
export function runTest(testId, cfg, ds) {
  const test = testById(testId);
  const report = {
    testId, title: test.name, subtitle: "", cards: [], tables: [], warnings: [], suggestions: [], sentence: "", chart: null, totalRows: ds.rows.length,
  };
  const builder = BUILDERS[testId];
  builder(report, cfg, ds);
  report.warnings = report.warnings.filter(Boolean);
  return report;
}

const BUILDERS = {
  describe(R, c, ds) {
    const v = ds.byName[c.v] || fail("Choose a variable.");
    R.subtitle = v.name;
    if (v.type === "numeric") {
      const vals = ds.rows.map(r => ds.num(r, v.name)).filter(Number.isFinite);
      if (vals.length < 2) fail("Need at least 2 numeric values.");
      const d = S.describe(vals), k = decimalsFor(vals), miss = ds.rows.length - vals.length;
      R.cards = [{ label: "N", value: fmtN(d.n) }, { label: "Mean ± SD", value: meanSd(d.mean, d.sd, k) }, { label: "Median (IQR)", value: medIqr(d.median, d.q1, d.q3, k) }, { label: "Range", value: `${fmt(d.min, k)}–${fmt(d.max, k)}` }];
      R.tables.push({ title: "Summary", columns: ["Statistic", "Value"], rows: [
        ["Valid N", fmtN(d.n)], ["Missing", `${miss} (${fmtPct(miss / ds.rows.length)})`],
        ["Mean ± SD", meanSd(d.mean, d.sd, k)], ["95% CI of mean", ci(d.ciLow, d.ciHigh, k)], ["Standard error", fmt(d.se, k + 1)],
        ["Median (IQR)", medIqr(d.median, d.q1, d.q3, k)], ["Minimum – maximum", `${fmt(d.min, k)} – ${fmt(d.max, k)}`],
        ["Skewness", fmt(d.skew, 3)], ["Kurtosis (excess)", fmt(d.kurt, 3)],
        ["Shapiro-Wilk W", d.shapiro ? fmt(d.shapiro.W, 3) : "n/a (n > 5000)"], ["Shapiro-Wilk p", d.shapiro ? pCell(d.shapiro.p) : "—"],
      ], notes: ["Quartiles use the SPSS weighted-average method."] });
      const normal = d.shapiro ? d.shapiro.p >= 0.05 : Math.abs(d.skew) < 1;
      R.cards.push({ label: "Normality", value: normal ? "Approx. normal" : "Not normal", tone: normal ? "good" : "warn" });
      if (!normal) R.suggestions.push({ text: "Not normally distributed: report median (IQR) and prefer non-parametric tests (Mann-Whitney, Kruskal-Wallis, Spearman, Wilcoxon)." });
      R.sentence = `${v.name} (n = ${d.n}) had a mean of ${fmt(d.mean, k)} ± ${fmt(d.sd, k)} (95% CI ${ci(d.ciLow, d.ciHigh, k)}) and a median of ${fmt(d.median, k)} (IQR ${fmt(d.q1, k)}–${fmt(d.q3, k)}), ranging from ${fmt(d.min, k)} to ${fmt(d.max, k)}. ` +
        (d.shapiro ? `The distribution ${normal ? "did not deviate significantly from normal" : "was not normal"} (Shapiro-Wilk W = ${fmt(d.shapiro.W, 3)}, ${pText(d.shapiro.p)}).` : "");
      R.chart = { type: "hist", data: S.histogram(vals), xLabel: v.name };
      R.warnings.push(miss ? `${miss} missing value(s) were excluded.` : null);
    } else if (v.type === "categorical") {
      const counts = new Map(); let n = 0;
      for (const r of ds.rows) { const x = ds.cat(r, v.name); if (x != null) { counts.set(x, (counts.get(x) || 0) + 1); n++; } }
      if (!n) fail("No values in this variable.");
      const levels = [...counts.keys()].sort(naturalCompare), miss = ds.rows.length - n;
      R.cards = [{ label: "Valid N", value: fmtN(n) }, { label: "Categories", value: fmtN(levels.length) }, { label: "Missing", value: fmtN(miss) }];
      const rows = levels.map(l => [l, fmtN(counts.get(l)), fmtPct(counts.get(l) / n)]);
      rows.push([{ t: "Total", bold: true }, { t: fmtN(n), bold: true }, { t: "100.0%", bold: true }]);
      R.tables.push({ title: "Frequency table", columns: ["Category", "n", "% of valid"], rows, notes: miss ? [`${miss} missing value(s) not included in percentages.`] : [] });
      R.sentence = `Of ${n} participants with data on ${v.name}, ` + levels.map(l => `${counts.get(l)} (${fmtPct(counts.get(l) / n)}) were ${l}`).join(", ").replace(/, ([^,]*)$/, levels.length > 1 ? " and $1" : "$1") + ".";
      R.chart = { type: "bars", data: levels.map(l => ({ label: l, value: (100 * counts.get(l)) / n, n: counts.get(l) })), unit: "%" };
    } else fail(`"${v.name}" is set to Ignore. Change its type in the Data tab to analyse it.`);
  },

  ttest(R, c, ds) { twoGroup(R, c, ds, false); },
  mannwhitney(R, c, ds) { twoGroup(R, c, ds, true); },
  anova(R, c, ds) { multiGroup(R, c, ds, false); },
  kruskal(R, c, ds) { multiGroup(R, c, ds, true); },
  pairedt(R, c, ds) { paired(R, c, ds, false); },
  wilcoxon(R, c, ds) { paired(R, c, ds, true); },

  mcnemar(R, c, ds) {
    const [a, b, dropped] = pairs(ds, c.before, c.after, "cat");
    const levels = [...new Set([...a, ...b])].sort(naturalCompare);
    if (levels.length !== 2) fail(`McNemar's test needs the same 2 categories before and after; found ${levels.length} (${levels.join(", ")}).`);
    const [L1, L2] = levels, t = [[0, 0], [0, 0]];
    a.forEach((v, i) => t[levels.indexOf(v)][levels.indexOf(b[i])]++);
    const m = S.mcnemar(t[0][0], t[0][1], t[1][0], t[1][1]), n = m.n;
    R.subtitle = `${c.before} → ${c.after}`;
    R.cards = [{ label: "Pairs", value: fmtN(n) }, { label: "Changed", value: `${m.b + m.c}` }, { label: "p (exact)", value: fmtP(m.pExact), p: m.pExact }];
    R.tables.push({ title: "Paired table", columns: [`${c.before} \\ ${c.after}`, L1, L2, "Total"], rows: [
      [{ t: L1, bold: true }, fmtN(t[0][0]), fmtN(t[0][1]), fmtN(t[0][0] + t[0][1])],
      [{ t: L2, bold: true }, fmtN(t[1][0]), fmtN(t[1][1]), fmtN(t[1][0] + t[1][1])],
      [{ t: "Total", bold: true }, fmtN(t[0][0] + t[1][0]), fmtN(t[0][1] + t[1][1]), fmtN(n)]] });
    const p1 = (t[1][0] + t[1][1]) / n, p2 = (t[0][1] + t[1][1]) / n;
    R.tables.push({ title: "Test", columns: ["Statistic", "Value", "p"], rows: [
      [`${L2} before → after`, `${fmtPct(p1)} → ${fmtPct(p2)}`, ""],
      ["McNemar exact (binomial)", `${m.b} vs ${m.c} discordant pairs`, pCell(m.pExact)],
      ["McNemar χ² (continuity-corrected)", `χ²(1) = ${fmt(m.chi2, 3)}`, pCell(m.pChi)]],
      notes: ["The exact binomial p-value is the one SPSS reports for 2×2 McNemar tables."] });
    R.sentence = `Among ${n} participants, the proportion classed as "${L2}" changed from ${fmtPct(p1)} before to ${fmtPct(p2)} after (${m.c} changed ${L2}→${L1}, ${m.b} changed ${L1}→${L2}). This change was ${sig(m.pExact) ? "" : "not "}statistically significant (McNemar's exact test, ${pText(m.pExact)}).`;
    R.chart = { type: "bars", data: [{ label: `Before`, value: 100 * p1 }, { label: `After`, value: 100 * p2 }], unit: "%", yLabel: `% ${L2}` };
    R.warnings.push(droppedWarn(dropped));
  },

  chisquare(R, c, ds) {
    const la = presentLevels(ds, c.row, c.col), lb = presentLevels(ds, c.col, c.row);
    const { t, n } = crosstab(ds, c.row, c.col, la, lb);
    const x = S.chiSquareTable(t);
    R.subtitle = `${c.row} × ${c.col}`;
    const is2 = la.length === 2 && lb.length === 2, useFisher = is2 && x.minExpected < 5;
    const mainP = useFisher ? x.fisherP : x.p;
    R.cards = [{ label: "χ²", value: fmt(x.chi2, 3) }, { label: "df", value: fmtN(x.df) }, { label: useFisher ? "p (Fisher)" : "p", value: fmtP(mainP), p: mainP }, { label: "Cramér's V", value: fmt(x.cramersV, 3) }];
    R.tables.push(crossTable(c.row, c.col, la, lb, t, x));
    const rows = [["Pearson chi-square", fmt(x.chi2, 3), fmtN(x.df), pCell(x.p)]];
    if (is2) { rows.push(["Continuity correction (Yates)", fmt(x.yates.chi2, 3), "1", pCell(x.yates.p)]); rows.push(["Fisher's exact test", "", "", pCell(x.fisherP)]); }
    rows.push(["Cramér's V", fmt(x.cramersV, 3), "", ""]); rows.push(["N", fmtN(n), "", ""]);
    R.tables.push({ title: "Tests", columns: ["Test", "Value", "df", "p"], rows, notes: [`${x.smallCells} cell(s) (${fmt(x.pctSmall, 1)}%) have expected count below 5. Minimum expected count is ${fmt(x.minExpected, 2)}.`] });
    if (x.pctSmall > 20) R.warnings.push(is2 ? "More than 20% of cells have expected counts below 5, so report Fisher's exact test." : "More than 20% of cells have expected counts below 5, so chi-square may be unreliable. Consider combining small categories.");
    if (is2) R.suggestions.push({ text: "For a 2×2 table you can also get odds ratio and relative risk.", testId: "twobytwo", cfg: { exposure: c.row, outcome: c.col } });
    R.sentence = `There was ${sig(mainP) ? "a statistically significant" : "no statistically significant"} association between ${c.row} and ${c.col} (` +
      (useFisher ? `Fisher's exact test, ${pText(mainP)}` : `χ²(${x.df}, N = ${n}) = ${fmt(x.chi2, 2)}, ${pText(x.p)}`) + `; Cramér's V = ${fmt(x.cramersV, 2)}).`;
    R.chart = { type: "grouped", data: la.map((a, i) => Object.fromEntries([["label", a], ...lb.map((b, j) => [b, x.rowT[i] ? (100 * t[i][j]) / x.rowT[i] : 0])])), keys: lb, unit: "%", yLabel: `% within ${c.row}` };
    R.warnings.push(droppedWarn(ds.rows.length - n));
  },

  twobytwo(R, c, ds) {
    const le = presentLevels(ds, c.exposure, c.outcome), lo = presentLevels(ds, c.outcome, c.exposure);
    if (le.length !== 2) fail(`"${c.exposure}" has ${le.length} categories with data. A 2×2 table needs exactly 2 (recode it, or use the chi-square test).`);
    if (lo.length !== 2) fail(`"${c.outcome}" has ${lo.length} categories with data. A 2×2 table needs exactly 2 (recode it, or use the chi-square test).`);
    const unexp = le.find(l => l !== c.exposedLevel), noEv = lo.find(l => l !== c.event);
    const { t, n } = crosstab(ds, c.exposure, c.outcome, [c.exposedLevel, unexp], [c.event, noEv]);
    const [[a, b], [cc, d]] = t;
    const m = S.twoByTwo(a, b, cc, d), x = S.chiSquareTable(t);
    R.subtitle = `${c.exposure} (${c.exposedLevel} vs ${unexp}) → ${c.outcome} (${c.event})`;
    const useFisher = x.minExpected < 5, mainP = useFisher ? x.fisherP : x.p;
    R.cards = [{ label: "Odds ratio", value: `${fmt(m.or)} (${ci(m.orLo, m.orHi)})` }, { label: "Relative risk", value: `${fmt(m.rr)} (${ci(m.rrLo, m.rrHi)})` }, { label: useFisher ? "p (Fisher)" : "p (χ²)", value: fmtP(mainP), p: mainP }];
    R.tables.push({ title: "2×2 table", columns: [c.exposure, `${c.event}`, `${noEv}`, "Total", `Risk of ${c.event}`], rows: [
      [{ t: `${c.exposedLevel} (exposed)`, bold: true }, `${a} (a)`, `${b} (b)`, fmtN(a + b), fmtPct(m.riskExp)],
      [{ t: `${unexp} (unexposed)`, bold: true }, `${cc} (c)`, `${d} (d)`, fmtN(cc + d), fmtPct(m.riskUnexp)],
      [{ t: "Total", bold: true }, fmtN(a + cc), fmtN(b + d), fmtN(n), fmtPct((a + cc) / n)]] });
    R.tables.push({ title: "Measures of association", columns: ["Measure", "Estimate", "95% CI"], rows: [
      ["Odds ratio (ad/bc)", fmt(m.or), ci(m.orLo, m.orHi)],
      ["Relative risk (risk ratio / prevalence ratio)", fmt(m.rr), ci(m.rrLo, m.rrHi)],
      ["Risk difference (attributable risk)", fmtPct(m.rd), `${fmtPct(m.rdLo)} to ${fmtPct(m.rdHi)}`],
      ["Attributable fraction in exposed", Number.isFinite(m.afe) ? fmtPct(m.afe) : "—", ""]],
      notes: ["Case-control study → report the odds ratio. Cohort or cross-sectional → relative risk (prevalence ratio) is also valid.",
        ...(m.corrected ? ["A cell is zero, so 0.5 was added to every cell for OR and RR (Haldane correction)."] : [])] });
    R.tables.push({ title: "Tests", columns: ["Test", "Value", "p"], rows: [
      ["Pearson chi-square", `χ²(1) = ${fmt(x.chi2, 3)}`, pCell(x.p)], ["Yates' corrected chi-square", `χ²(1) = ${fmt(x.yates.chi2, 3)}`, pCell(x.yates.p)],
      ["Fisher's exact test (two-sided)", "", pCell(x.fisherP)]],
      notes: [useFisher ? "An expected count is below 5, so report Fisher's exact test." : "All expected counts are 5 or more, so the chi-square test is appropriate."] });
    const dir = m.or > 1 ? "higher" : "lower", test = useFisher ? "Fisher's exact test" : "χ² test";
    R.sentence = `${c.outcome} = ${c.event} was seen in ${fmtPct(m.riskExp)} of those with ${c.exposure} = ${c.exposedLevel} and ${fmtPct(m.riskUnexp)} of those with ${c.exposure} = ${unexp}. ` +
      (sig(mainP)
        ? `${c.exposure} = ${c.exposedLevel} was significantly associated with ${dir} odds of ${c.outcome} (OR ${fmt(m.or)}, 95% CI ${ci(m.orLo, m.orHi)}; RR ${fmt(m.rr)}, 95% CI ${ci(m.rrLo, m.rrHi)}; ${test}, ${pText(mainP)}).`
        : `This association was not statistically significant (OR ${fmt(m.or)}, 95% CI ${ci(m.orLo, m.orHi)}; RR ${fmt(m.rr)}, 95% CI ${ci(m.rrLo, m.rrHi)}; ${test}, ${pText(mainP)}).`);
    R.chart = { type: "bars", data: [{ label: `${c.exposedLevel}`, value: 100 * m.riskExp }, { label: `${unexp}`, value: 100 * m.riskUnexp }], unit: "%", yLabel: `% with ${c.event}` };
    R.warnings.push(droppedWarn(ds.rows.length - n));
  },

  pearson(R, c, ds) { correlation(R, c, ds, false); },
  spearman(R, c, ds) { correlation(R, c, ds, true); },
  linear(R, c, ds) { regression(R, c, ds, false); },
  logistic(R, c, ds) { regression(R, c, ds, true); },
};

function crossTable(rowVar, colVar, la, lb, t, x) {
  const rows = la.map((a, i) => [{ t: a, bold: true }, ...lb.map((_, j) => `${t[i][j]} (${fmtPct(x.rowT[i] ? t[i][j] / x.rowT[i] : 0)})`), fmtN(x.rowT[i])]);
  rows.push([{ t: "Total", bold: true }, ...lb.map((_, j) => `${x.colT[j]} (${fmtPct(x.colT[j] / x.n)})`), fmtN(x.n)]);
  return { title: "Cross-tabulation, n (row %)", columns: [`${rowVar} \\ ${colVar}`, ...lb, "Total"], rows };
}

function twoGroup(R, c, ds, nonParam) {
  if (!c.levelA || !c.levelB) fail("Choose a grouping variable that has at least 2 categories.");
  const [g1, g2] = groupValues(ds, c.outcome, c.group, [c.levelA, c.levelB]);
  if (g1.length < 2 || g2.length < 2) fail(`Each group needs at least 2 values (found ${g1.length} and ${g2.length}).`);
  const k = decimalsFor([...g1, ...g2]), d1 = S.describe(g1), d2 = S.describe(g2);
  const nLevels = levelsOf(ds, c.group).length;
  R.subtitle = `${c.outcome} by ${c.group} (${c.levelA} vs ${c.levelB})`;
  if (nLevels > 2) R.warnings.push(`"${c.group}" has ${nLevels} categories; only ${c.levelA} and ${c.levelB} are compared. To compare all groups use ${nonParam ? "Kruskal-Wallis" : "ANOVA"}.`);
  const stats = [[c.levelA, d1], [c.levelB, d2]];
  if (!nonParam) {
    const r = S.independentT(g1, g2), eq = r.levene.p >= 0.05, use = eq ? r.student : r.welch;
    R.cards = [{ label: "t", value: fmt(use.t, 3) }, { label: "df", value: fmt(use.df, eq ? 0 : 1) }, { label: "p", value: fmtP(use.p), p: use.p }, { label: "Mean difference", value: fmt(r.diff, k) }, { label: "Cohen's d", value: fmt(r.cohenD, 2) }];
    R.tables.push({ title: "Group statistics", columns: ["Group", "n", "Mean ± SD", "95% CI of mean", "Median (IQR)", "Shapiro-Wilk p"],
      rows: stats.map(([l, d]) => [{ t: l, bold: true }, fmtN(d.n), meanSd(d.mean, d.sd, k), ci(d.ciLow, d.ciHigh, k), medIqr(d.median, d.q1, d.q3, k), d.shapiro ? pCell(d.shapiro.p) : "—"]) });
    R.tables.push({ title: "Independent samples t-test", columns: ["Variances", "t", "df", "p", "Mean difference", "95% CI"], rows: [
      [{ t: "Equal (Student)" + (eq ? " ← report" : ""), bold: eq }, fmt(r.student.t, 3), fmtN(r.student.df), pCell(r.student.p), fmt(r.diff, k), ci(r.student.lo, r.student.hi, k)],
      [{ t: "Unequal (Welch)" + (!eq ? " ← report" : ""), bold: !eq }, fmt(r.welch.t, 3), fmt(r.welch.df, 1), pCell(r.welch.p), fmt(r.diff, k), ci(r.welch.lo, r.welch.hi, k)]],
      notes: [`Levene's test for equal variances: F = ${fmt(r.levene.F, 3)}, ${pText(r.levene.p)} → ${eq ? "variances can be assumed equal" : "variances differ, so use the Welch row"}.`, "Mean difference = Group 1 − Group 2."] });
    R.sentence = `Mean ${c.outcome} was ${fmt(d1.mean, k)} ± ${fmt(d1.sd, k)} in ${c.levelA} (n = ${d1.n}) and ${fmt(d2.mean, k)} ± ${fmt(d2.sd, k)} in ${c.levelB} (n = ${d2.n}). ` +
      `The difference of ${fmt(r.diff, k)} (95% CI ${ci(use.lo, use.hi, k)}) was ${sig(use.p) ? "" : "not "}statistically significant (${eq ? "independent t-test" : "Welch's t-test"}, t(${fmt(use.df, eq ? 0 : 1)}) = ${fmt(use.t, 2)}, ${pText(use.p)}; Cohen's d = ${fmt(r.cohenD, 2)}).`;
    const notNormal = stats.map(([l, d]) => normalityNote(l, d.shapiro)).filter(Boolean);
    if (notNormal.length && Math.min(d1.n, d2.n) < 30) R.suggestions.push({ text: `${notNormal.join("; ")}. With small groups, the Mann-Whitney U test is safer.`, testId: "mannwhitney", cfg: c });
    R.chart = { type: "meanci", data: stats.map(([l, d]) => ({ label: l, value: d.mean, lo: d.ciLow, hi: d.ciHigh })), yLabel: `Mean ${c.outcome} (95% CI)` };
  } else {
    const r = S.mannWhitney(g1, g2);
    R.cards = [{ label: "U", value: fmt(r.U, 1) }, { label: "Z", value: fmt(r.z, 3) }, { label: "p", value: fmtP(r.p), p: r.p }, { label: "Effect size r", value: fmt(r.r, 2) }];
    R.tables.push({ title: "Group statistics", columns: ["Group", "n", "Median (IQR)", "Mean rank", "Mean ± SD"], rows: [
      [{ t: c.levelA, bold: true }, fmtN(d1.n), medIqr(d1.median, d1.q1, d1.q3, k), fmt(r.meanRank1, 2), meanSd(d1.mean, d1.sd, k)],
      [{ t: c.levelB, bold: true }, fmtN(d2.n), medIqr(d2.median, d2.q1, d2.q3, k), fmt(r.meanRank2, 2), meanSd(d2.mean, d2.sd, k)]] });
    R.tables.push({ title: "Mann-Whitney U test", columns: ["U", "Z", "p", "Method", "Effect size r"], rows: [[fmt(r.U, 1), fmt(r.z, 3), pCell(r.p), r.method === "exact" ? "Exact" : "Asymptotic (tie-corrected)", fmt(r.r, 2)]],
      notes: ["Effect size r = |Z|/√N: 0.1 small, 0.3 medium, 0.5 large."] });
    R.sentence = `Median ${c.outcome} was ${fmt(d1.median, k)} (IQR ${fmt(d1.q1, k)}–${fmt(d1.q3, k)}) in ${c.levelA} (n = ${d1.n}) and ${fmt(d2.median, k)} (IQR ${fmt(d2.q1, k)}–${fmt(d2.q3, k)}) in ${c.levelB} (n = ${d2.n}). ` +
      `This difference was ${sig(r.p) ? "" : "not "}statistically significant (Mann-Whitney U = ${fmt(r.U, 1)}, Z = ${fmt(r.z, 2)}, ${pText(r.p)}; r = ${fmt(r.r, 2)}).`;
    R.chart = { type: "meanci", data: stats.map(([l, d]) => ({ label: l, value: d.median, lo: d.q1, hi: d.q3 })), yLabel: `Median ${c.outcome} (IQR)` };
  }
  const total = ds.rows.filter(r => [c.levelA, c.levelB].includes(ds.cat(r, c.group))).length;
  R.warnings.push(droppedWarn(total - g1.length - g2.length));
}

function multiGroup(R, c, ds, nonParam) {
  const levels = levelsOf(ds, c.group);
  const groups = groupValues(ds, c.outcome, c.group, levels);
  const keep = levels.map((l, i) => [l, groups[i]]).filter(([, g]) => g.length > 0);
  const tiny = keep.filter(([, g]) => g.length < 2);
  if (tiny.length) fail(`These groups have fewer than 2 values: ${tiny.map(([l]) => l).join(", ")}. Recode or merge them first.`);
  if (keep.length < 2) fail("Need at least 2 groups with data.");
  const L = keep.map(([l]) => l), G = keep.map(([, g]) => g), k = decimalsFor(G.flat()), D = G.map(g => S.describe(g));
  R.subtitle = `${c.outcome} by ${c.group} (${L.length} groups)`;
  if (L.length === 2) R.warnings.push(`Only 2 groups: this gives the same answer as the ${nonParam ? "Mann-Whitney U test" : "independent t-test"}.`);
  if (L.length > 10) R.warnings.push(`${L.length} groups is a lot. Check that "${c.group}" is really a grouping variable.`);
  if (!nonParam) {
    const a = S.oneWayAnova(G);
    R.cards = [{ label: "F", value: fmt(a.F, 3) }, { label: "df", value: `${a.dfB}, ${a.dfW}` }, { label: "p", value: fmtP(a.p), p: a.p }, { label: "η² (eta squared)", value: fmt(a.eta2, 3) }];
    R.tables.push({ title: "Group statistics", columns: ["Group", "n", "Mean ± SD", "95% CI of mean", "Median (IQR)", "Shapiro-Wilk p"],
      rows: L.map((l, i) => [{ t: l, bold: true }, fmtN(D[i].n), meanSd(D[i].mean, D[i].sd, k), ci(D[i].ciLow, D[i].ciHigh, k), medIqr(D[i].median, D[i].q1, D[i].q3, k), D[i].shapiro ? pCell(D[i].shapiro.p) : "—"]) });
    R.tables.push({ title: "ANOVA", columns: ["Source", "Sum of squares", "df", "Mean square", "F", "p"], rows: [
      ["Between groups", fmt(a.SSB, 2), fmtN(a.dfB), fmt(a.MSB, 2), fmt(a.F, 3), pCell(a.p)],
      ["Within groups", fmt(a.SSW, 2), fmtN(a.dfW), fmt(a.MSW, 2), "", ""],
      [{ t: "Total", bold: true }, fmt(a.SSB + a.SSW, 2), fmtN(a.dfB + a.dfW), "", "", ""]],
      notes: [`Levene's test: F(${a.levene.df1}, ${a.levene.df2}) = ${fmt(a.levene.F, 3)}, ${pText(a.levene.p)}.`] });
    R.tables.push({ title: "Post-hoc pairwise comparisons (Bonferroni)", columns: ["Comparison", "Mean difference", "95% CI", "Adjusted p"],
      rows: a.pairs.map(q => [`${L[q.i]} vs ${L[q.j]}`, fmt(q.diff, k), ci(q.lo, q.hi, k), pCell(q.p)]),
      notes: ["Uses the pooled ANOVA error term, as in SPSS. Interpret only if the overall ANOVA is significant."] });
    if (a.levene.p < 0.05) R.warnings.push(`Group variances differ (Levene ${pText(a.levene.p)}). Consider the Kruskal-Wallis test.`);
    const notNormal = L.map((l, i) => normalityNote(l, D[i].shapiro)).filter(Boolean);
    if (notNormal.length || a.levene.p < 0.05) R.suggestions.push({ text: `${notNormal.length ? notNormal.join("; ") + ". " : ""}The Kruskal-Wallis test does not assume normality or equal variances.`, testId: "kruskal", cfg: c });
    const sigPairs = a.pairs.filter(q => q.p < 0.05).map(q => `${L[q.i]} vs ${L[q.j]}`);
    R.sentence = `Mean ${c.outcome} ${sig(a.p) ? "differed significantly" : "did not differ significantly"} across categories of ${c.group} (one-way ANOVA, F(${a.dfB}, ${a.dfW}) = ${fmt(a.F, 2)}, ${pText(a.p)}, η² = ${fmt(a.eta2, 3)}). ` +
      L.map((l, i) => `${l}: ${fmt(D[i].mean, k)} ± ${fmt(D[i].sd, k)}`).join("; ") + "." +
      (sig(a.p) ? (sigPairs.length ? ` Bonferroni post-hoc tests showed significant differences for ${sigPairs.join(", ")}.` : " No individual pair differed significantly after Bonferroni correction.") : "");
    R.chart = { type: "meanci", data: L.map((l, i) => ({ label: l, value: D[i].mean, lo: D[i].ciLow, hi: D[i].ciHigh })), yLabel: `Mean ${c.outcome} (95% CI)` };
  } else {
    const r = S.kruskalWallis(G);
    R.cards = [{ label: "H", value: fmt(r.H, 3) }, { label: "df", value: fmtN(r.df) }, { label: "p", value: fmtP(r.p), p: r.p }, { label: "ε² (epsilon squared)", value: fmt(r.epsilon2, 3) }];
    R.tables.push({ title: "Group statistics", columns: ["Group", "n", "Median (IQR)", "Mean rank"],
      rows: L.map((l, i) => [{ t: l, bold: true }, fmtN(D[i].n), medIqr(D[i].median, D[i].q1, D[i].q3, k), fmt(r.meanRanks[i], 2)]) });
    R.tables.push({ title: "Post-hoc pairwise comparisons (Dunn, Bonferroni)", columns: ["Comparison", "Z", "Adjusted p"],
      rows: r.pairs.map(q => [`${L[q.i]} vs ${L[q.j]}`, fmt(q.z, 3), pCell(q.p)]), notes: ["Interpret only if the overall Kruskal-Wallis test is significant."] });
    const sigPairs = r.pairs.filter(q => q.p < 0.05).map(q => `${L[q.i]} vs ${L[q.j]}`);
    R.sentence = `${c.outcome} ${sig(r.p) ? "differed significantly" : "did not differ significantly"} across categories of ${c.group} (Kruskal-Wallis H(${r.df}) = ${fmt(r.H, 2)}, ${pText(r.p)}). Medians (IQR): ` +
      L.map((l, i) => `${l} ${fmt(D[i].median, k)} (${fmt(D[i].q1, k)}–${fmt(D[i].q3, k)})`).join("; ") + "." +
      (sig(r.p) ? (sigPairs.length ? ` Dunn's post-hoc tests (Bonferroni) showed significant differences for ${sigPairs.join(", ")}.` : " No individual pair differed significantly after Bonferroni correction.") : "");
    R.chart = { type: "meanci", data: L.map((l, i) => ({ label: l, value: D[i].median, lo: D[i].q1, hi: D[i].q3 })), yLabel: `Median ${c.outcome} (IQR)` };
  }
  const total = ds.rows.filter(r => ds.cat(r, c.group) != null).length;
  R.warnings.push(droppedWarn(total - G.flat().length));
}

function paired(R, c, ds, nonParam) {
  const [x, y, dropped] = pairs(ds, c.before, c.after);
  if (x.length < 2) fail("Need at least 2 rows with both measurements.");
  const k = decimalsFor([...x, ...y]), dx = S.describe(x), dy = S.describe(y);
  R.subtitle = `${c.before} vs ${c.after}`;
  if (!nonParam) {
    const r = S.pairedT(x, y);
    R.cards = [{ label: "t", value: fmt(r.t, 3) }, { label: "df", value: fmtN(r.df) }, { label: "p", value: fmtP(r.p), p: r.p }, { label: "Mean difference", value: fmt(r.meanDiff, k) }];
    R.tables.push({ title: "Paired statistics", columns: ["Measurement", "n", "Mean ± SD", "Median (IQR)"], rows: [
      [{ t: c.before, bold: true }, fmtN(dx.n), meanSd(dx.mean, dx.sd, k), medIqr(dx.median, dx.q1, dx.q3, k)],
      [{ t: c.after, bold: true }, fmtN(dy.n), meanSd(dy.mean, dy.sd, k), medIqr(dy.median, dy.q1, dy.q3, k)]] });
    R.tables.push({ title: "Paired t-test", columns: ["Mean difference ± SD", "95% CI", "t", "df", "p", "Cohen's dz"], rows: [[meanSd(r.meanDiff, r.sdDiff, k), ci(r.lo, r.hi, k), fmt(r.t, 3), fmtN(r.df), pCell(r.p), fmt(r.dz, 2)]],
      notes: [`Difference = ${c.before} − ${c.after}.`, r.shapiroDiff ? `Normality of differences: Shapiro-Wilk ${pText(r.shapiroDiff.p)}.` : ""].filter(Boolean) });
    if (r.shapiroDiff && r.shapiroDiff.p < 0.05 && r.n < 30) R.suggestions.push({ text: `The differences are not normally distributed (Shapiro-Wilk ${pText(r.shapiroDiff.p)}). With a small sample, the Wilcoxon signed-rank test is safer.`, testId: "wilcoxon", cfg: c });
    R.sentence = `Mean ${c.before} was ${fmt(dx.mean, k)} ± ${fmt(dx.sd, k)} and mean ${c.after} was ${fmt(dy.mean, k)} ± ${fmt(dy.sd, k)} (n = ${r.n} pairs). ` +
      `The mean difference of ${fmt(r.meanDiff, k)} (95% CI ${ci(r.lo, r.hi, k)}) was ${sig(r.p) ? "" : "not "}statistically significant (paired t-test, t(${r.df}) = ${fmt(r.t, 2)}, ${pText(r.p)}).`;
    R.chart = { type: "meanci", data: [{ label: c.before, value: dx.mean, lo: dx.ciLow, hi: dx.ciHigh }, { label: c.after, value: dy.mean, lo: dy.ciLow, hi: dy.ciHigh }], yLabel: "Mean (95% CI)" };
  } else {
    const r = S.wilcoxonSignedRank(x, y);
    R.cards = [{ label: "Z", value: fmt(r.z, 3) }, { label: "p", value: fmtP(r.p), p: r.p }, { label: "Effect size r", value: fmt(r.r, 2) }, { label: "Median difference", value: fmt(r.medianDiff, k) }];
    R.tables.push({ title: "Paired statistics", columns: ["Measurement", "n", "Median (IQR)", "Mean ± SD"], rows: [
      [{ t: c.before, bold: true }, fmtN(dx.n), medIqr(dx.median, dx.q1, dx.q3, k), meanSd(dx.mean, dx.sd, k)],
      [{ t: c.after, bold: true }, fmtN(dy.n), medIqr(dy.median, dy.q1, dy.q3, k), meanSd(dy.mean, dy.sd, k)]] });
    R.tables.push({ title: "Wilcoxon signed-rank test", columns: ["Decreased", "Increased", "No change", "Z", "p", "Method"], rows: [[fmtN(r.nPos), fmtN(r.nNeg), fmtN(r.nZero), fmt(r.z, 3), pCell(r.p), r.method === "exact" ? "Exact" : "Asymptotic (tie-corrected)"]],
      notes: [`"Decreased" means ${c.after} < ${c.before}. Pairs with no change are left out of the test, as in SPSS.`] });
    R.sentence = `Median ${c.before} was ${fmt(dx.median, k)} (IQR ${fmt(dx.q1, k)}–${fmt(dx.q3, k)}) and median ${c.after} was ${fmt(dy.median, k)} (IQR ${fmt(dy.q1, k)}–${fmt(dy.q3, k)}) (n = ${x.length} pairs). ` +
      `The change was ${sig(r.p) ? "" : "not "}statistically significant (Wilcoxon signed-rank test, Z = ${fmt(r.z, 2)}, ${pText(r.p)}; r = ${fmt(r.r, 2)}).`;
    R.chart = { type: "meanci", data: [{ label: c.before, value: dx.median, lo: dx.q1, hi: dx.q3 }, { label: c.after, value: dy.median, lo: dy.q1, hi: dy.q3 }], yLabel: "Median (IQR)" };
  }
  R.warnings.push(droppedWarn(dropped, "rows without both measurements"));
}

function correlation(R, c, ds, rank) {
  const [x, y, dropped] = pairs(ds, c.x, c.y);
  R.subtitle = `${c.x} and ${c.y}`;
  if (!rank) {
    const r = S.pearson(x, y), swx = S.shapiroWilk(x), swy = S.shapiroWilk(y);
    R.cards = [{ label: "r", value: fmt(r.r, 3) }, { label: "95% CI", value: ci(r.lo, r.hi, 2) }, { label: "p", value: fmtP(r.p), p: r.p }, { label: "r²", value: fmt(r.r * r.r, 3) }, { label: "n", value: fmtN(r.n) }];
    R.tables.push({ title: "Pearson correlation", columns: ["r", "95% CI", "r²", "t", "df", "p", "n"], rows: [[fmt(r.r, 3), ci(r.lo, r.hi, 3), fmt(r.r * r.r, 3), fmt(r.t, 3), fmtN(r.df), pCell(r.p), fmtN(r.n)]],
      notes: [`Regression line: ${c.y} = ${fmt(r.intercept, 3)} + ${fmt(r.slope, 3)} × ${c.x}.`, "Strength: <0.1 negligible, 0.1–0.39 weak, 0.4–0.69 moderate, 0.7–0.89 strong, ≥0.9 very strong."] });
    const notNormal = [normalityNote(c.x, swx), normalityNote(c.y, swy)].filter(Boolean);
    if (notNormal.length) R.suggestions.push({ text: `${notNormal.join("; ")}. Spearman's correlation does not assume normality and is less affected by outliers.`, testId: "spearman", cfg: c });
    R.sentence = `There was a ${strength(r.r)} ${r.r >= 0 ? "positive" : "negative"} correlation between ${c.x} and ${c.y} (Pearson r = ${fmt(r.r, 2)}, 95% CI ${ci(r.lo, r.hi, 2)}, n = ${r.n}, ${pText(r.p)}), which was ${sig(r.p) ? "" : "not "}statistically significant.`;
    const [lo, hi] = S.minMax(x);
    R.chart = { type: "scatter", points: sample(x, y), xLabel: c.x, yLabel: c.y, line: [{ x: lo, y: r.intercept + r.slope * lo }, { x: hi, y: r.intercept + r.slope * hi }] };
  } else {
    const r = S.spearman(x, y);
    R.cards = [{ label: "ρ (rho)", value: fmt(r.rho, 3) }, { label: "p", value: fmtP(r.p), p: r.p }, { label: "n", value: fmtN(r.n) }];
    R.tables.push({ title: "Spearman rank correlation", columns: ["ρ", "p", "n"], rows: [[fmt(r.rho, 3), pCell(r.p), fmtN(r.n)]],
      notes: ["Strength: <0.1 negligible, 0.1–0.39 weak, 0.4–0.69 moderate, 0.7–0.89 strong, ≥0.9 very strong."] });
    R.sentence = `There was a ${strength(r.rho)} ${r.rho >= 0 ? "positive" : "negative"} correlation between ${c.x} and ${c.y} (Spearman ρ = ${fmt(r.rho, 2)}, n = ${r.n}, ${pText(r.p)}), which was ${sig(r.p) ? "" : "not "}statistically significant.`;
    R.chart = { type: "scatter", points: sample(x, y), xLabel: c.x, yLabel: c.y };
  }
  R.warnings.push(droppedWarn(dropped));
}
function sample(x, y, max = 1500) {
  const step = Math.max(1, Math.ceil(x.length / max)), out = [];
  for (let i = 0; i < x.length; i += step) out.push({ x: x[i], y: y[i] });
  return out;
}

// Build a design matrix with dummy variables for categorical predictors.
function design(ds, outcome, predictors, refs, getY) {
  if (!predictors.length) fail("Tick at least one predictor.");
  const rows = ds.rows.filter(r => getY(r) != null && predictors.every(p => (ds.byName[p].type === "numeric" ? Number.isFinite(ds.num(r, p)) : ds.cat(r, p) != null)));
  const terms = [], blocks = [];
  for (const p of predictors) {
    if (ds.byName[p].type === "numeric") { blocks.push({ p, type: "numeric", cols: [terms.length] }); terms.push({ name: p, get: r => ds.num(r, p) }); }
    else {
      const lv = [...new Set(rows.map(r => ds.cat(r, p)))].sort(naturalCompare);
      const ref = lv.includes(refs[p]) ? refs[p] : lv[0];
      if (lv.length < 2) fail(`"${p}" has only one category among the complete rows, so it cannot be a predictor.`);
      const cols = [];
      for (const l of lv) if (l !== ref) { cols.push(terms.length); terms.push({ name: `${p}: ${l}`, level: l, get: r => (ds.cat(r, p) === l ? 1 : 0) }); }
      blocks.push({ p, type: "categorical", ref, levels: lv, cols });
    }
  }
  const X = rows.map(r => terms.map(t => t.get(r))), y = rows.map(getY);
  return { X, y, terms, blocks, rows, excluded: ds.rows.length - rows.length };
}

function regression(R, c, ds, logistic) {
  const outcomeLevels = logistic ? levelsOf(ds, c.outcome) : [];
  const getY = logistic ? r => { const v = ds.cat(r, c.outcome); return v == null ? null : v === c.event ? 1 : 0; } : r => { const v = ds.num(r, c.outcome); return Number.isFinite(v) ? v : null; };
  const { X, y, terms, blocks, excluded } = design(ds, c.outcome, c.predictors, c.refs || {}, getY);
  const names = terms.map(t => t.name);
  R.subtitle = `${c.outcome}${logistic ? ` (${c.event} = 1)` : ""} ~ ${c.predictors.join(" + ")}`;
  if (excluded) R.warnings.push(`${excluded} row(s) with a missing outcome or predictor were excluded (complete-case analysis).`);
  if (!logistic) {
    const m = S.linearRegression(X, y, names), k = decimalsFor(y);
    R.cards = [{ label: "R²", value: fmt(m.R2, 3) }, { label: "Adjusted R²", value: fmt(m.adjR2, 3) }, { label: `F(${m.dfModel}, ${m.df})`, value: fmt(m.F, 2) }, { label: "p (model)", value: fmtP(m.pModel), p: m.pModel }, { label: "n", value: fmtN(m.n) }];
    const rows = [];
    m.coefs.forEach((co, i) => {
      if (i > 0) { const blk = blocks.find(b => b.cols[0] === i - 1 && b.type === "categorical"); if (blk) rows.push([{ t: `${blk.p} (ref: ${blk.ref})`, bold: true }, "", "", "", "", ""]); }
      const t = i === 0 ? null : terms[i - 1];
      rows.push([{ t: i === 0 ? "(Constant)" : t.level != null ? t.level : co.name, indent: t?.level != null }, fmt(co.b, 3), fmt(co.se, 3), ci(co.lo, co.hi, 3), fmt(co.t, 3), pCell(co.p)]);
    });
    R.tables.push({ title: "Coefficients", columns: ["Term", "B", "SE", "95% CI for B", "t", "p"], rows, notes: ["B = change in the outcome for a 1-unit increase in the predictor (or versus the reference category), holding the others constant."] });
    R.tables.push({ title: "Model summary", columns: ["n", "R²", "Adjusted R²", "F", "df", "p", "Residual SE"], rows: [[fmtN(m.n), fmt(m.R2, 3), fmt(m.adjR2, 3), fmt(m.F, 3), `${m.dfModel}, ${m.df}`, pCell(m.pModel), fmt(m.rmse, k)]] });
    if (m.n < 10 * names.length) R.warnings.push(`Only ${m.n} rows for ${names.length} term(s). Aim for at least 10 rows per term.`);
    const sigTerms = m.coefs.slice(1).filter(co => co.p < 0.05).map(co => `${co.name} (B = ${fmt(co.b, 2)}, 95% CI ${ci(co.lo, co.hi, 2)}, ${pText(co.p)})`);
    R.sentence = `The model explained ${fmt(100 * m.R2, 1)}% of the variation in ${c.outcome} (R² = ${fmt(m.R2, 3)}, adjusted R² = ${fmt(m.adjR2, 3)}; F(${m.dfModel}, ${m.df}) = ${fmt(m.F, 2)}, ${pText(m.pModel)}; n = ${m.n}). ` +
      (sigTerms.length ? `Significant predictors were ${sigTerms.join("; ")}.` : "No predictor was statistically significant.");
    if (names.length === 1 && blocks[0].type === "numeric") {
      const xs = X.map(r => r[0]), [lo, hi] = S.minMax(xs), [b0, b1] = [m.coefs[0].b, m.coefs[1].b];
      R.chart = { type: "scatter", points: sample(xs, y), xLabel: names[0], yLabel: c.outcome, line: [{ x: lo, y: b0 + b1 * lo }, { x: hi, y: b0 + b1 * hi }] };
    }
    return;
  }
  // Logistic
  if (outcomeLevels.length < 2) fail(`"${c.outcome}" needs at least 2 categories.`);
  const others = outcomeLevels.filter(l => l !== c.event);
  if (others.length > 1) R.warnings.push(`"${c.outcome}" has ${outcomeLevels.length} categories: ${c.event} is coded 1 and all others (${others.join(", ")}) are coded 0.`);
  const events = S.sum(y), nonEvents = y.length - events;
  if (!events || !nonEvents) fail(`All complete rows are ${events ? c.event : "not " + c.event}. Logistic regression needs both outcomes.`);
  const m = S.logisticRegression(X, y, names);
  if (m.separation) R.warnings.push("Perfect or near-perfect separation: a predictor (or category) almost perfectly predicts the outcome, so its odds ratio and CI are unreliable. Check for categories with 0 events or 0 non-events and merge or remove them.");
  const epv = Math.min(events, nonEvents) / names.length;
  if (epv < 10) R.warnings.push(`Only ${fmt(epv, 1)} events per predictor term (recommended at least 10). Results may be unstable; use fewer predictors.`);
  // Crude (univariable) ORs on the same rows
  const crude = {};
  for (const blk of blocks) {
    try {
      const cm = S.logisticRegression(X.map(r => blk.cols.map(j => r[j])), y, blk.cols.map(j => names[j]));
      blk.cols.forEach((j, i) => { crude[j] = { ...cm.coefs[i + 1], sep: cm.separation }; });
    } catch { /* leave blank */ }
  }
  const orTxt = (co, sepFlag) => (co && Number.isFinite(co.or) ? `${fmt(co.or)} (${ci(co.lo, co.hi)})${sepFlag ? " ⚠" : ""}` : "—");
  const rows = [];
  for (const blk of blocks) {
    if (blk.type === "numeric") {
      const j = blk.cols[0];
      rows.push([{ t: blk.p, bold: true }, orTxt(crude[j], crude[j]?.sep), crude[j] ? pCell(crude[j].p) : "—", orTxt(m.coefs[j + 1], m.separation), pCell(m.coefs[j + 1].p)]);
    } else {
      rows.push([{ t: blk.p, bold: true }, "", "", "", ""]);
      rows.push([{ t: `${blk.ref} (reference)`, indent: true }, "1", "", "1", ""]);
      blk.cols.forEach(j => rows.push([{ t: terms[j].level, indent: true }, orTxt(crude[j], crude[j]?.sep), crude[j] ? pCell(crude[j].p) : "—", orTxt(m.coefs[j + 1], m.separation), pCell(m.coefs[j + 1].p)]));
    }
  }
  R.cards = [{ label: "n (events)", value: `${m.n} (${m.events})` }, { label: `Model χ²(${m.lrDf})`, value: fmt(m.lr, 2) }, { label: "p (model)", value: fmtP(m.lrP), p: m.lrP }, { label: "Nagelkerke R²", value: fmt(m.nagelkerke, 3) }];
  R.tables.push({ title: "Crude and adjusted odds ratios", columns: ["Variable", "Crude OR (95% CI)", "p", "Adjusted OR (95% CI)", "p"], rows,
    notes: [`Outcome: ${c.outcome} = ${c.event} (coded 1).`, "Crude = each predictor on its own; adjusted = all predictors together. Both use the same complete rows.", "OR > 1: higher odds of the event; OR < 1: lower odds. For a numeric predictor, the OR is per 1-unit increase."] });
  R.tables.push({ title: "Variables in the equation", columns: ["Term", "B", "SE", "Wald", "p", "Exp(B)", "95% CI for Exp(B)"],
    rows: m.coefs.map(co => [co.name, fmt(co.b, 3), fmt(co.se, 3), fmt(co.wald, 3), pCell(co.p), fmt(co.or, 3), co.name === "(Constant)" ? "" : ci(co.lo, co.hi, 3)]) });
  R.tables.push({ title: "Model fit", columns: ["Statistic", "Value"], rows: [
    ["Omnibus test (likelihood ratio)", `χ²(${m.lrDf}) = ${fmt(m.lr, 3)}, ${pText(m.lrP)}`], ["−2 Log likelihood", fmt(-2 * m.ll, 3)],
    ["Cox & Snell R²", fmt(m.coxSnell, 3)], ["Nagelkerke R²", fmt(m.nagelkerke, 3)],
    ["Hosmer-Lemeshow", m.hl ? `χ²(${m.hl.df}) = ${fmt(m.hl.chi2, 3)}, ${pText(m.hl.p)} (p > 0.05 = good fit)` : "Needs n ≥ 20"],
    ["Correctly classified (cut-off 0.5)", fmtPct(m.accuracy)], ["Events / non-events", `${events} / ${nonEvents}`]] });
  const sigTerms = m.coefs.slice(1).filter(co => co.p < 0.05).map(co => `${co.name} (AOR ${fmt(co.or)}, 95% CI ${ci(co.lo, co.hi)}, ${pText(co.p)})`);
  R.sentence = `In multivariable logistic regression (n = ${m.n}, ${events} with ${c.outcome} = ${c.event}), ` +
    (sigTerms.length ? `the factors independently associated with ${c.outcome} = ${c.event} were ${sigTerms.join("; ")}.` : "no predictor was independently associated with the outcome.") +
    ` The model was ${sig(m.lrP) ? "" : "not "}significant overall (χ²(${m.lrDf}) = ${fmt(m.lr, 2)}, ${pText(m.lrP)}; Nagelkerke R² = ${fmt(m.nagelkerke, 3)}` +
    (m.hl ? `; Hosmer-Lemeshow ${pText(m.hl.p)}` : "") + ").";
  R.chart = { type: "forest", data: m.coefs.slice(1).filter(co => Number.isFinite(co.lo) && Number.isFinite(co.hi) && co.hi < 1e6 && co.lo > 1e-6).map(co => ({ label: co.name, or: co.or, lo: co.lo, hi: co.hi, sig: co.p < 0.05 })) };
}

// Compact, privacy-safe summary for the AI (no raw rows or points).
export function aiSummary(report) {
  return {
    test: report.title, variables: report.subtitle,
    keyResults: report.cards.map(c => `${c.label}: ${c.value}`),
    tables: report.tables.slice(0, 3).map(t => ({ title: t.title, columns: t.columns, rows: t.rows.slice(0, 25).map(r => r.map(x => (typeof x === "object" ? x.t : x))) })),
    warnings: report.warnings, draftSentence: report.sentence,
  };
}
