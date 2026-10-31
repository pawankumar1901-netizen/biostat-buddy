// A small made-up dataset so people can try every test without their own file.
export function demoSheet() {
  let seed = 20261031;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const norm = (m, sd) => m + sd * Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const pick = (arr, w) => { const r = rnd(); let c = 0; for (let i = 0; i < arr.length; i++) { c += w[i]; if (r < c) return arr[i]; } return arr[arr.length - 1]; };
  const aoa = [["ID", "Age", "Sex", "Residence", "SES", "BMI", "SBP", "Smoking", "Diabetes", "Hb_baseline", "Hb_followup", "Anaemia_baseline", "Anaemia_followup",
    "Height_cm", "Weight_kg", "RBS", "Glucometer_screen", "Pallor_Doctor1", "Pallor_Doctor2", "Q1", "Q2", "Q3", "Q4", "Q5", "FollowUp_months", "Status"]];
  // Extra columns use their own random stream so the original columns stay the same.
  let seed2 = 7051983;
  const r2 = () => ((seed2 = (seed2 * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const n2 = (m, sd) => m + sd * Math.sqrt(-2 * Math.log(r2() + 1e-12)) * Math.cos(2 * Math.PI * r2());
  const lik = x => String(Math.min(5, Math.max(1, Math.round(x))));
  for (let i = 1; i <= 180; i++) {
    const age = Math.round(norm(46, 12)), sex = pick(["Male", "Female"], [0.48, 0.52]);
    const res = pick(["Rural", "Urban", "Slum"], [0.45, 0.35, 0.2]), ses = pick(["Upper", "Middle", "Lower"], [0.25, 0.45, 0.3]);
    const bmi = Math.round(norm(25, 4) * 10) / 10, smoke = sex === "Male" ? pick(["Yes", "No"], [0.35, 0.65]) : pick(["Yes", "No"], [0.05, 0.95]);
    const sbp = Math.round(98 + 0.55 * age + 0.9 * bmi + (smoke === "Yes" ? 4 : 0) + norm(0, 10));
    const lp = -9 + 0.07 * age + 0.16 * bmi + (smoke === "Yes" ? 0.6 : 0);
    const dm = rnd() < 1 / (1 + Math.exp(-lp)) ? "Yes" : "No";
    const hb0 = Math.round(norm(sex === "Male" ? 12.8 : 11.0, 1.3) * 10) / 10, hb1 = Math.round((hb0 + norm(0.5, 0.7)) * 10) / 10;
    const cut = sex === "Male" ? 13 : 12;
    const ht = Math.round(n2(sex === "Male" ? 166 : 153, 6)), wt = Math.round(bmi * (ht / 100) ** 2 * 10) / 10;
    const rbs = Math.round(dm === "Yes" ? n2(205, 45) : n2(118, 25));
    const screen = rbs + n2(0, 22) >= 160 ? "Positive" : "Negative";
    const pallorTrue = hb0 < cut ? r2() < 0.8 : r2() < 0.12;
    const doc = () => (r2() < 0.86 ? pallorTrue : !pallorTrue) ? "Present" : "Absent";
    const know = n2(0, 1), q = () => lik(3 + 0.9 * know + n2(0, 0.75));
    const hz = 0.012 * Math.exp(0.035 * (age - 46) + (dm === "Yes" ? 0.8 : 0) + (smoke === "Yes" ? 0.4 : 0));
    const tEvent = -Math.log(r2() + 1e-12) / hz, tCens = 6 + 30 * r2();
    const fu = Math.round(Math.min(tEvent, tCens) * 10) / 10, died = tEvent <= tCens;
    const row = [`P${String(i).padStart(3, "0")}`, age, sex, res, ses, bmi, sbp, smoke, dm, hb0, hb1, hb0 < cut ? "Yes" : "No", hb1 < cut ? "Yes" : "No",
      ht, wt, rbs, screen, doc(), doc(), q(), q(), q(), q(), lik(3 - 0.6 * know + n2(0, 0.9)), Math.max(0.1, fu), died ? "Died" : "Alive"].map(String);
    if (i % 19 === 0) row[6] = "";
    if (i % 29 === 0) row[5] = "NA";
    aoa.push(row);
  }
  return { sheets: [{ name: "Sample", aoa }] };
}
