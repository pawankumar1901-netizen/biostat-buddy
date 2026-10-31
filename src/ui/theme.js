import { useCallback, useEffect, useState } from "react";

// Colours are CSS variables defined in index.html for the light (Astra clean) and dark themes.
export const C = {
  bg: "var(--bg)", surface: "var(--surface)", card: "var(--card)", border: "var(--border)",
  accent: "var(--accent)", onAccent: "var(--on-accent)", green: "var(--green)", yellow: "var(--yellow)", red: "var(--red)",
  purple: "var(--purple)", text: "var(--text)", muted: "var(--muted)",
};
// Chart series colours: mid-tones that read on both light and dark backgrounds.
export const PALETTE = ["#2F80D9", "#1FA36A", "#E8873A", "#8B6CF0", "#E05252", "#2BA3B5", "#C9A227", "#D9609C"];
export const FONT = "'Figtree', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
// Translucent version of any colour, including CSS variables (hex alpha like "44" → 27%).
export const mix = (color, hexAlpha) => `color-mix(in srgb, ${color} ${Math.round((parseInt(hexAlpha, 16) / 255) * 100)}%, transparent)`;

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

// Light by default; the choice is remembered on this device.
export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  const toggle = useCallback(() => {
    setTheme(t => {
      const next = t === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#0D1117" : "#FFFFFF");
      try { localStorage.setItem("bb-theme", next); } catch { /* private mode */ }
      return next;
    });
  }, []);
  return [theme, toggle];
}

export const s = {
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 16, boxShadow: "var(--shadow)" },
  label: { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 6, display: "block", fontWeight: 600 },
  select: { background: C.surface, border: `1px solid ${C.border}`, color: C.text, padding: "9px 10px", borderRadius: 7, fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit" },
  input: { background: C.surface, border: `1px solid ${C.border}`, color: C.text, padding: "9px 10px", borderRadius: 7, fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit" },
  btn: { background: C.accent, color: C.onAccent, border: "none", padding: "10px 18px", borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" },
  ghost: { background: "transparent", border: `1px solid ${C.border}`, color: C.text, padding: "7px 12px", borderRadius: 6, fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
  h3: { fontSize: 11, color: C.muted, letterSpacing: 1.4, textTransform: "uppercase", margin: "0 0 10px", fontWeight: 700 },
  th: { padding: "7px 10px", color: C.muted, fontWeight: 700, textAlign: "left", borderBottom: `1px solid ${C.border}`, fontSize: 11, whiteSpace: "nowrap" },
  td: { padding: "6px 10px", fontSize: 13, borderBottom: `1px solid ${mix(C.border, "88")}`, verticalAlign: "top", fontVariantNumeric: "tabular-nums" },
  tag: col => ({ display: "inline-block", background: mix(col, "22"), color: col, border: `1px solid ${mix(col, "44")}`, borderRadius: 4, fontSize: 10, padding: "2px 6px", letterSpacing: 0.4, whiteSpace: "nowrap", fontWeight: 600 }),
};
