// A small made-up dataset so people can try every test without their own file.
export function demoSheet() {
  let seed = 20261031;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const norm = (m, sd) => m + sd * Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const pick = (arr, w) => { const r = rnd(); let c = 0; for (let i = 0; i < arr.length; i++) { c += w[i]; if (r < c) return arr[i]; } return arr[arr.length - 1]; };
  const aoa = [["ID", "Age", "Sex", "Residence", "SES", "BMI", "SBP", "Smoking", "Diabetes", "Hb_baseline", "Hb_followup", "Anaemia_baseline", "Anaemia_followup"]];
  for (let i = 1; i <= 180; i++) {
    const age = Math.round(norm(46, 12)), sex = pick(["Male", "Female"], [0.48, 0.52]);
    const res = pick(["Rural", "Urban", "Slum"], [0.45, 0.35, 0.2]), ses = pick(["Upper", "Middle", "Lower"], [0.25, 0.45, 0.3]);
    const bmi = Math.round(norm(25, 4) * 10) / 10, smoke = sex === "Male" ? pick(["Yes", "No"], [0.35, 0.65]) : pick(["Yes", "No"], [0.05, 0.95]);
    const sbp = Math.round(98 + 0.55 * age + 0.9 * bmi + (smoke === "Yes" ? 4 : 0) + norm(0, 10));
    const lp = -9 + 0.07 * age + 0.16 * bmi + (smoke === "Yes" ? 0.6 : 0);
    const dm = rnd() < 1 / (1 + Math.exp(-lp)) ? "Yes" : "No";
    const hb0 = Math.round(norm(sex === "Male" ? 12.8 : 11.0, 1.3) * 10) / 10, hb1 = Math.round((hb0 + norm(0.5, 0.7)) * 10) / 10;
    const cut = sex === "Male" ? 13 : 12;
    const row = [`P${String(i).padStart(3, "0")}`, age, sex, res, ses, bmi, sbp, smoke, dm, hb0, hb1, hb0 < cut ? "Yes" : "No", hb1 < cut ? "Yes" : "No"].map(String);
    if (i % 19 === 0) row[6] = "";
    if (i % 29 === 0) row[5] = "NA";
    aoa.push(row);
  }
  return { sheets: [{ name: "Sample", aoa }] };
}
