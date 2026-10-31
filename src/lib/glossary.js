// "What does this mean?" — short, plain explanations shown beside statistics.
const G = {
  p: "The chance of seeing a difference this big (or bigger) if there were really no difference. Below 0.05 is usually called statistically significant. It does not tell you how big or important the effect is.",
  ci: "95% confidence interval: the range of values the true effect is likely to lie in. A narrow interval means a precise estimate. For a ratio (OR, RR), an interval that includes 1 means no clear effect; for a difference, one that includes 0.",
  df: "Degrees of freedom: a number based on the sample size and number of groups, used to look up the p-value. Report it with the test statistic, e.g. t(48) = 2.1.",
  t: "The t statistic: the difference between means divided by its standard error. The further from 0, the stronger the evidence of a difference.",
  F: "The F statistic compares variation between groups with variation within groups. Larger F means the group means are more different.",
  U: "Mann-Whitney U: based on ranking all values together. Report it with the medians (IQR) of each group.",
  H: "Kruskal-Wallis H: a rank-based statistic for 3 or more groups. Report it with the medians (IQR).",
  Z: "A z score: how many standard errors the result is from no effect. Beyond ±1.96 corresponds to p < 0.05.",
  chi2: "Chi-square (χ²): compares the observed counts with the counts expected if there were no association. Larger means a bigger difference from 'no association'.",
  or: "Odds ratio: odds of the outcome in the exposed divided by the odds in the unexposed. 1 = no association, above 1 = higher odds, below 1 = lower odds (protective). Use for case-control studies.",
  rr: "Relative risk: risk in the exposed divided by risk in the unexposed. 1 = no difference. Use for cohort studies and trials; not for case-control studies.",
  d: "Cohen's d: the difference in means measured in standard deviations. About 0.2 is small, 0.5 medium and 0.8 large.",
  r: "Correlation coefficient: from −1 to +1. 0 means no straight-line relationship; the sign shows the direction.",
  rEffect: "Effect size r for a non-parametric test: about 0.1 small, 0.3 medium, 0.5 large.",
  r2: "R²: the proportion of the variation in the outcome explained by the model. 0.30 means 30% explained.",
  eta2: "η² (eta squared): proportion of variation explained by the groups. About 0.01 small, 0.06 medium, 0.14 large.",
  eps2: "ε² (epsilon squared): effect size for Kruskal-Wallis. About 0.01 small, 0.08 medium, 0.26 large.",
  cramer: "Cramér's V: strength of association between categories, from 0 (none) to 1 (perfect). About 0.1 weak, 0.3 moderate, 0.5 strong.",
  sens: "Sensitivity: of the people who truly have the disease, the percentage the test correctly picks up. High sensitivity is needed for screening (few cases missed).",
  spec: "Specificity: of the people without the disease, the percentage the test correctly calls negative. High specificity avoids false alarms.",
  ppv: "Positive predictive value: if the test is positive, the chance the person truly has the disease. It falls when the disease is rare.",
  npv: "Negative predictive value: if the test is negative, the chance the person is truly free of the disease.",
  auc: "Area under the ROC curve: the chance that a random person with the disease has a higher score than a random person without it. 0.5 = no better than chance, 1 = perfect.",
  cutoff: "Best cut-off by Youden's index: the score that gives the highest sensitivity + specificity together. Other cut-offs may suit better if missing a case is worse than a false alarm.",
  kappa: "Cohen's kappa: agreement between two raters after removing agreement expected by chance. 0 = chance level, 1 = perfect. 0.61–0.80 is substantial.",
  alpha: "Cronbach's alpha: how consistently the items of a scale measure the same thing. 0.7 or more is usually acceptable; above 0.95 may mean some items are repetitive.",
  median_surv: "Median survival: the time by which half of the participants have had the event. 'Not reached' means fewer than half had the event during follow-up.",
  logrank: "Log-rank test: compares whole survival curves between groups. A small p means survival differs between groups.",
  trend: "Chi-square for trend: tests whether the proportion goes steadily up or down across ordered groups, which is more powerful than the ordinary chi-square when there is a dose-response.",
  normality: "Shapiro-Wilk test of normality: p < 0.05 suggests the data are not normally distributed, so medians (IQR) and non-parametric tests are safer.",
  sd: "Standard deviation: how spread out the values are around the mean. About 95% of values lie within 2 SD of the mean if the data are normal.",
  iqr: "Median and interquartile range (25th to 75th percentile): the middle value and the spread of the middle half. Best for skewed data.",
  agree: "Observed agreement: the percentage of cases where both raters gave the same category. Part of this would happen by chance, which kappa accounts for.",
};
const RULES = [
  [/^p\b|^p \(/i, "p"], [/95% CI/, "ci"], [/^df$/, "df"], [/^t$/, "t"], [/^F\b|^F\(/, "F"], [/^U$/, "U"], [/^H$/, "H"], [/^Z$/, "Z"],
  [/for trend/, "trend"], [/Log-rank/, "logrank"], [/χ²|Model χ²/, "chi2"], [/Odds ratio/, "or"], [/Relative risk/, "rr"], [/Cohen's d/, "d"],
  [/Effect size r/, "rEffect"], [/^r$|ρ/, "r"], [/R²|r²/, "r2"], [/η²/, "eta2"], [/ε²/, "eps2"], [/Cramér/, "cramer"],
  [/^Sensitivity$|Sens \/ Spec/, "sens"], [/^Specificity$/, "spec"], [/^PPV$/, "ppv"], [/^NPV$/, "npv"], [/AUC/, "auc"], [/Best cut-off/, "cutoff"],
  [/Kappa/, "kappa"], [/Cronbach/, "alpha"], [/Median survival/, "median_surv"], [/Normality/, "normality"], [/Mean ± SD/, "sd"], [/Median \(IQR\)/, "iqr"],
  [/Observed agreement/, "agree"],
];
export function glossFor(label) {
  for (const [re, k] of RULES) if (re.test(label)) return G[k];
  return null;
}
