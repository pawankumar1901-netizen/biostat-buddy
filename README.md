# Biostat Buddy

Biostatistics for MBBS interns and PG theses, by Dr. Pawan Kumar B · Community Medicine.
Live at https://biostat-buddy.netlify.app — installable and works offline.

**Tests:** descriptive statistics with Shapiro-Wilk, independent t-test (Student/Welch with Levene), Mann-Whitney U, one-way ANOVA with Bonferroni post-hoc, Kruskal-Wallis with Dunn post-hoc, paired t-test, Wilcoxon signed-rank, McNemar, chi-square (Yates, Fisher), 2×2 OR / RR / risk difference, Pearson, Spearman, linear regression, binary logistic regression with crude and adjusted ORs, chi-square for trend, diagnostic accuracy (sensitivity, specificity, PPV, NPV, LRs with exact CIs), ROC curve (DeLong AUC, Youden cut-off), Cohen's kappa, Cronbach's alpha, Kaplan-Meier with log-rank.

**Also:** Table 1 generator (copy into Word), test guide, results written as thesis-ready sentences, PDF export, CSV/Excel/SPSS (.sav, .zsav) upload with missing-value handling, data tools (merge categories, make groups from cut-offs, compute with formulas, subgroup filter), report basket with numbered tables and figures exported to Word (.docx) or PDF, box plots and chart images, "what does this mean?" tips, and a "How to cite" note.

**Saving:** recent files, their settings and the report are kept in the browser (IndexedDB) on the user's device only. There is no account or server storage.

## Develop

```
npm install
npm run dev
npm test
```

`npm test` checks the statistics against reference values from SciPy.

## AI explain

The **AI explain** button calls `netlify/functions/interpret.mts`, which uses Netlify AI Gateway (no key needed on credit-based Netlify plans). To use your own Anthropic key instead, add `ANTHROPIC_API_KEY` under Netlify → Project configuration → Environment variables, then redeploy. Only summary results are sent, never the raw data.

Never commit `node_modules/` or `dist/` (see `.gitignore`).
