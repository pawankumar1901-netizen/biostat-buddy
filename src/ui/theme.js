import { useEffect, useState } from "react";

export const C = {
  bg: "#0D1117", surface: "#161B22", card: "#1C2333", border: "#30363D",
  accent: "#58A6FF", green: "#3FB950", yellow: "#E3B341", red: "#F85149",
  purple: "#BC8CFF", text: "#E6EDF3", muted: "#8B949E",
};
export const PALETTE = ["#58A6FF", "#3FB950", "#E3B341", "#BC8CFF", "#F85149", "#79C0FF", "#56D364", "#F0883E"];
export const MONO = "'JetBrains Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace";

export function useNarrow(px = 820) {
  const q = `(max-width: ${px}px)`;
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q), on = () => setNarrow(m.matches);
    m.addEventListener("change", on); on();
    return () => m.removeEventListener("change", on);
  }, [q]);
  return narrow;
}

export const s = {
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 16 },
  label: { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, display: "block" },
  select: { background: C.surface, border: `1px solid ${C.border}`, color: C.text, padding: "9px 10px", borderRadius: 7, fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit" },
  input: { background: C.surface, border: `1px solid ${C.border}`, color: C.text, padding: "9px 10px", borderRadius: 7, fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit" },
  btn: { background: C.accent, color: "#0D1117", border: "none", padding: "10px 18px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
  ghost: { background: "transparent", border: `1px solid ${C.border}`, color: C.text, padding: "7px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  h3: { fontSize: 11, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", margin: "0 0 10px", fontWeight: 600 },
  th: { padding: "7px 10px", color: C.muted, fontWeight: 600, textAlign: "left", borderBottom: `1px solid ${C.border}`, fontSize: 11, whiteSpace: "nowrap" },
  td: { padding: "6px 10px", fontSize: 12, borderBottom: `1px solid ${C.border}55`, verticalAlign: "top" },
  tag: col => ({ display: "inline-block", background: col + "22", color: col, border: `1px solid ${col}44`, borderRadius: 4, fontSize: 10, padding: "2px 6px", letterSpacing: 0.5, whiteSpace: "nowrap" }),
};
