// Biostat Buddy mark: a bell curve with three rising bars on the left half and "p <" on the right half.
// Colours come from CSS variables so the mark follows the light/dark theme.
export const BELL = "M4 66 C30 66 40 10 60 10 C80 10 90 66 116 66";

export function Mark({ width = 56, small = false, title = "Biostat Buddy" }) {
  return (
    <svg viewBox="0 0 120 80" width={width} height={(width * 80) / 120} role="img" aria-label={title} style={{ display: "block", flex: "none" }}>
      <path d={`${BELL} Z`} fill="var(--logo-fill)" />
      <rect x="22" y="54" width={small ? 10 : 9} height="12" rx="1.6" fill="#8EC7F6" />
      <rect x="34" y="42" width={small ? 10 : 9} height="24" rx="1.6" fill="#58B0EE" />
      <rect x="46" y="30" width={small ? 10 : 9} height="36" rx="1.6" fill="#27AE9A" />
      {!small && <line x1="60" y1="12" x2="60" y2="66" stroke="#5AA2DA" strokeWidth="1.6" strokeDasharray="3.5 3" />}
      {!small && (
        <text x="64" y="57" fontFamily="'Plus Jakarta Sans','Figtree',system-ui,sans-serif" fontSize="19" fontWeight="800" letterSpacing="-.5" fill="var(--brand-a)">
          p<tspan fill="var(--brand-b)" dx="1">&lt;</tspan>
        </text>
      )}
      <path d={BELL} fill="none" stroke="var(--logo-curve)" strokeWidth={small ? 4 : 2.6} strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ size = 20 }) {
  return (
    <span style={{ fontFamily: "'Plus Jakarta Sans','Figtree',system-ui,sans-serif", fontWeight: 800, letterSpacing: "-0.02em", fontSize: size, lineHeight: 1, whiteSpace: "nowrap" }}>
      <span style={{ color: "var(--brand-a)" }}>Biostat</span> <span style={{ color: "var(--brand-b)" }}>Buddy</span>
    </span>
  );
}
