// Checks the statistics engine against reference values produced by SciPy 1.18.
// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as S from "../src/lib/stats.js";

const { input: I, y, expected: E } = JSON.parse(readFileSync(new URL("./scipy-reference.json", import.meta.url)));
const close = (a, b, tol = 1e-6, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, expected ${b}`);

test("Shapiro-Wilk", () => { for (const [k, [W, p]] of Object.entries(E.shapiro)) { const r = S.shapiroWilk(I.cases[k]); close(r.W, W, 1e-4, k); close(r.p, p, 1e-3, k); } });
test("t-tests and Levene", () => {
  const r = S.independentT(I.g1, I.g2);
  close(r.welch.p, E.welch_p); close(r.student.p, E.student_p); close(r.levene.p, E.levene_p);
  close(S.independentT(I.big1, I.big2).welch.p, E.welch_big_p, 1e-6, "large sample");
  close(S.pairedT(I.pre, I.post).p, E.paired_p);
});
test("ANOVA", () => close(S.oneWayAnova([I.g1, I.g2, I.g3]).p, E.anova_p));
test("Mann-Whitney", () => { close(S.mannWhitney(I.small1, I.small2).p, E.mw_exact_p); close(S.mannWhitney(I.tied1, I.tied2).p, E.mw_tied_p); });
test("Kruskal-Wallis", () => close(S.kruskalWallis([I.g1, I.g2, I.g3]).p, E.kw_p));
test("Wilcoxon", () => { close(S.wilcoxonSignedRank(I.pre_s, I.post_s).p, E.wil_exact_p); close(S.wilcoxonSignedRank(I.pre, I.post).p, E.wil_approx_p); });
test("Correlation", () => { const r = S.pearson(I.g1, y); close(r.r, E.pearson[0]); close(r.p, E.pearson[1]); close(S.spearman(I.g1, y).p, E.spearman_p); });
test("Contingency tables", () => {
  const x = S.chiSquareTable([[12, 5], [3, 9]]);
  close(x.p, E.chi2x2_p); close(x.yates.p, E.yates_p); close(x.fisherP, E.fisher_p);
  const m = S.twoByTwo(30, 70, 15, 85); close(m.or, E.or[0]); close(m.orLo, E.or[1]); close(m.rrLo, E.rr_lo);
  close(S.mcnemar(40, 12, 4, 44).pExact, E.mcnemar_p);
});
test("Large-sample p-values do not overflow", () => { close(S.pT2(2, 400), E.t_df400, 1e-9); close(S.pChi(300, 350), E.chi_350, 1e-9); });
test("Logistic regression flags separation", () => {
  const X = [], yy = []; for (let i = 0; i < 40; i++) { X.push([i]); yy.push(i >= 20 ? 1 : 0); }
  assert.equal(S.logisticRegression(X, yy, ["X"]).separation, true);
});

const N = JSON.parse(readFileSync(new URL("./new-reference.json", import.meta.url)));
test("Clopper-Pearson exact CI", () => { const [lo, hi] = S.exactCI(37, 50); close(lo, N.cp[0], 1e-6); close(hi, N.cp[1], 1e-6); });
test("ROC AUC", () => close(S.roc(N.scores, N.labels).auc, N.auc, 1e-9));
test("Cohen's kappa", () => close(S.cohenKappa(N.kt).kappa, N.kappa, 1e-9));
test("Cronbach's alpha", () => close(S.cronbach(N.items).alpha, N.alpha, 1e-9));
test("Kaplan-Meier median and log-rank", () => {
  close(S.kaplanMeier(N.time.slice(0, 30), N.event.slice(0, 30)).median, N.km_median, 1e-9);
  close(S.logRank(N.time, N.event, N.grp, ["A", "B"]).p, N.lr_p, 1e-6);
});
