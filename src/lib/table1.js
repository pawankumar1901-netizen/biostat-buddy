// Biostat Buddy — "Table 1" (baseline characteristics) generator.
import * as S from "./stats.js";
import { levelsOf } from "./data.js";
import { fmt, fmtP, meanSd, medIqr, decimalsFor } from "./format.js";

const MARK = { welch: "a", anova: "b", mw: "c", kw: "d", chi: "e", fisher: "f" };
const LEGEND = {
  a: "Independent t-test (Welch)", b: "One-way ANOVA", c: "Mann-Whitney U test", d: "Kruskal-Wallis test",
  e: "Chi-square test", f: "Fisher's exact test",
};

// opts: { group: name|"", vars: [names], numericMode: "auto"|"mean"|"median", showOverall: bool, showP: bool }
export function buildTable1(ds, opts) {
  const { group, vars, numericMode = "auto", showOverall = true, showP = true } = opts;
  if (!vars.length) throw new Error("Tick at least one variable to include.");
  const groups = group ? levelsOf(ds, group) : [];
  if (group && groups.length < 2) throw new Error(`"${group}" needs at least 2 categories to compare groups.`);
  if (group && groups.length > 8) throw new Error(`"${group}" has ${groups.length} categories. Choose a grouping variable with 8 or fewer.`);
  const rowsIn = group ? ds.rows.filter(r => ds.cat(r, group) != null) : ds.rows;
  const gRows = groups.map(g => rowsIn.filter(r => ds.cat(r, group) === g));
  const cols = ["Characteristic"];
  if (showOverall || !group) cols.push(`Overall (n = ${rowsIn.length})`);
  groups.forEach((g, i) => cols.push(`${g} (n = ${gRows[i].length})`));
  const withP = showP && group;
  if (withP) cols.push("p-value");
  const out = [], used = new Set(), notes = [];
  let anySmall = false, anyMissing = false;

  for (const name of vars.filter(v => v !== group)) {
    const v = ds.byName[name];
    if (!v || v.type === "ignore") continue;
    if (v.type === "numeric") {
      const all = rowsIn.map(r => ds.num(r, name)).filter(Number.isFinite);
      if (all.length < rowsIn.length) anyMissing = true;
      if (all.length < 2) continue;
      const k = decimalsFor(all);
      let useMedian = numericMode === "median";
      if (numericMode === "auto") {
        const sw = S.shapiroWilk(all);
        useMedian = sw ? sw.p < 0.05 : Math.abs(S.describe(all).skew) > 1;
      }
      const summ = vals => { if (vals.length < 1) return "—"; const d = S.describe(vals); return useMedian ? medIqr(d.median, d.q1, d.q3, k) : meanSd(d.mean, d.sd, k); };
      const row = [{ t: `${name}, ${useMedian ? "median (IQR)" : "mean ± SD"}`, bold: true }];
      if (showOverall || !group) row.push(summ(all));
      const gv = gRows.map(rs => rs.map(r => ds.num(r, name)).filter(Number.isFinite));
      gv.forEach(vals => row.push(summ(vals)));
      if (withP) {
        let p = NaN, m = "";
        const ok = gv.filter(g => g.length >= 2);
        try {
          if (ok.length === gv.length) {
            if (gv.length === 2) { if (useMedian) { p = S.mannWhitney(gv[0], gv[1]).p; m = MARK.mw; } else { p = S.independentT(gv[0], gv[1]).welch.p; m = MARK.welch; } }
            else if (useMedian) { p = S.kruskalWallis(gv).p; m = MARK.kw; } else { p = S.oneWayAnova(gv).p; m = MARK.anova; }
          }
        } catch { p = NaN; }
        if (m) used.add(m);
        row.push({ t: Number.isFinite(p) ? `${fmtP(p)}${m ? sup(m) : ""}` : "—", sig: p < 0.05 });
      }
      out.push(row);
    } else {
      const levels = levelsOf(ds, name);
      const counts = rs => { const c = levels.map(() => 0); let n = 0; for (const r of rs) { const i = levels.indexOf(ds.cat(r, name)); if (i >= 0) { c[i]++; n++; } } return { c, n }; };
      const overall = counts(rowsIn);
      if (overall.n < rowsIn.length) anyMissing = true;
      if (!overall.n) continue;
      const gc = gRows.map(counts);
      const head = [{ t: `${name}, n (%)`, bold: true }];
      if (showOverall || !group) head.push("");
      gc.forEach(() => head.push(""));
      if (withP) {
        let p = NaN, m = "";
        const present = levels.map((_, i) => gc.some(g => g.c[i] > 0));
        const tab = gc.map(g => g.c.filter((_, i) => present[i]));
        try {
          if (tab[0].length >= 2) {
            const x = S.chiSquareTable(tab);
            if (x.fisherP != null && x.minExpected < 5) { p = x.fisherP; m = MARK.fisher; }
            else { p = x.p; m = MARK.chi; if (x.pctSmall > 20) anySmall = true; }
          }
        } catch { p = NaN; }
        if (m) used.add(m);
        head.push({ t: Number.isFinite(p) ? `${fmtP(p)}${m ? sup(m) : ""}` : "—", sig: p < 0.05 });
      }
      out.push(head);
      levels.forEach((l, i) => {
        const row = [{ t: l, indent: true }];
        const cell = ({ c, n }) => (n ? `${c[i]} (${fmt((100 * c[i]) / n, 1)})` : "—");
        if (showOverall || !group) row.push(cell(overall));
        gc.forEach(g => row.push(cell(g)));
        if (withP) row.push("");
        out.push(row);
      });
    }
  }
  if (!out.length) throw new Error("None of the ticked variables has data to summarise.");
  notes.push("Values are mean ± SD, median (IQR) or n (%). Percentages are within each column, excluding missing values.");
  [...used].sort().forEach(m => notes.push(`${sup(m)} ${LEGEND[m]}`));
  if (anySmall) notes.push("Some chi-square tests have more than 20% of cells with expected count below 5; interpret with caution.");
  if (anyMissing) notes.push("Some variables have missing values; n may vary by row.");
  if (numericMode === "auto") notes.push("Numeric variables were shown as median (IQR) when the Shapiro-Wilk test indicated non-normality (p < 0.05).");
  return { title: group ? `Table 1. Characteristics of participants by ${group}` : "Table 1. Characteristics of participants", columns: cols, rows: out, notes };
}
const SUP = { a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ" };
const sup = m => SUP[m] || m;
