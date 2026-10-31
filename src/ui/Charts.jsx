import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ErrorBar,
  ScatterChart, Scatter, ReferenceLine, Legend, LabelList, ReferenceDot,
} from "recharts";
import { C, PALETTE, mix } from "./theme.js";
import { fmt } from "../lib/format.js";

const tip = { contentStyle: { background: C.card, border: `1px solid ${C.border}`, fontSize: 12, color: C.text }, labelStyle: { color: C.text }, itemStyle: { color: C.text } };
const tick = { fill: C.muted, fontSize: 11 };
const axisLabel = (value, angle = 0) => ({ value, angle, fill: C.muted, fontSize: 11, position: angle ? "insideLeft" : "insideBottom", offset: angle ? 10 : -4, style: { textAnchor: "middle" } });

function niceTicks(lo, hi, n = 5) {
  if (!(hi > lo)) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(st => st >= raw);
  const out = []; for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) out.push(+t.toFixed(10));
  return out;
}

// Box plot drawn as plain SVG: median, IQR box, 1.5×IQR whiskers, outliers as dots.
export function BoxPlot({ box }) {
  const W = 600, H = 260, m = { l: 62, r: 14, t: 12, b: 34 };
  const all = box.data.flatMap(d => [d.wLo, d.wHi, ...d.out]);
  let lo = Math.min(...all), hi = Math.max(...all); const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
  const ticks = niceTicks(lo, hi), y = v => m.t + (H - m.t - m.b) * (1 - (v - lo) / (hi - lo));
  const bw = (W - m.l - m.r) / box.data.length, x = i => m.l + bw * (i + 0.5), half = Math.min(46, bw * 0.28);
  return (
    <svg className="bb-svg" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Box plot" style={{ display: "block", maxHeight: 300 }}>
      {ticks.filter(t => t >= lo && t <= hi).map(t => (
        <g key={t}><line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke={C.border} strokeDasharray="3 3" />
          <text x={m.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={C.muted}>{fmt(t, Math.abs(t) < 10 && t % 1 ? 1 : 0)}</text></g>
      ))}
      {box.yLabel && <text transform={`translate(14 ${(H - m.b + m.t) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill={C.muted}>{box.yLabel}</text>}
      {box.data.map((d, i) => {
        const col = PALETTE[i % PALETTE.length];
        return (
          <g key={d.label}>
            <line x1={x(i)} x2={x(i)} y1={y(d.wHi)} y2={y(d.q3)} stroke={C.text} />
            <line x1={x(i)} x2={x(i)} y1={y(d.q1)} y2={y(d.wLo)} stroke={C.text} />
            <line x1={x(i) - half / 2} x2={x(i) + half / 2} y1={y(d.wHi)} y2={y(d.wHi)} stroke={C.text} />
            <line x1={x(i) - half / 2} x2={x(i) + half / 2} y1={y(d.wLo)} y2={y(d.wLo)} stroke={C.text} />
            <rect x={x(i) - half} width={half * 2} y={y(d.q3)} height={Math.max(1, y(d.q1) - y(d.q3))} fill={col} fillOpacity="0.35" stroke={col} strokeWidth="1.5" />
            <line x1={x(i) - half} x2={x(i) + half} y1={y(d.med)} y2={y(d.med)} stroke={C.text} strokeWidth="2.5" />
            {d.out.map((o, j) => <circle key={j} cx={x(i)} cy={y(o)} r="3" fill="none" stroke={col} />)}
            <text x={x(i)} y={H - m.b + 18} textAnchor="middle" fontSize="11" fill={C.text}>{d.label.length > 18 ? d.label.slice(0, 17) + "…" : d.label}</text>
            <text x={x(i)} y={H - m.b + 31} textAnchor="middle" fontSize="10" fill={C.muted}>n = {d.n}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ChartView({ chart, mode }) {
  if (!chart) return null;
  if (mode === "box" && chart.box?.data.length) return <BoxPlot box={chart.box} />;
  const { type } = chart;
  if (type === "hist") {
    return (
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={chart.data} margin={{ top: 8, right: 8, bottom: 24, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="label" tick={tick} interval="preserveStartEnd" label={axisLabel(chart.xLabel)} />
          <YAxis tick={tick} allowDecimals={false} />
          <Tooltip {...tip} cursor={{ fill: mix(C.border, "55") }} formatter={v => [v, "Count"]} />
          <Bar dataKey="count" fill={C.accent} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (type === "bars") {
    return (
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={chart.data} margin={{ top: 18, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="label" tick={tick} interval={0} />
          <YAxis tick={tick} unit={chart.unit} domain={[0, "auto"]} label={chart.yLabel ? axisLabel(chart.yLabel, -90) : undefined} />
          <Tooltip {...tip} cursor={{ fill: mix(C.border, "55") }} formatter={v => [`${fmt(v, 1)}${chart.unit || ""}`, chart.yLabel || "Percent"]} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {chart.data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            <LabelList dataKey="value" position="top" fill={C.muted} fontSize={11} formatter={v => `${fmt(v, 1)}${chart.unit || ""}`} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (type === "meanci") {
    const data = chart.data.map(d => ({ ...d, err: [d.value - d.lo, d.hi - d.value] }));
    return (
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="label" tick={tick} interval={0} />
          <YAxis tick={tick} label={axisLabel(chart.yLabel, -90)} width={64} />
          <Tooltip {...tip} cursor={{ fill: mix(C.border, "55") }} formatter={(v, n, p) => [`${fmt(v)} (${fmt(p.payload.lo)} to ${fmt(p.payload.hi)})`, chart.yLabel]} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false} fillOpacity={0.85}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            <ErrorBar dataKey="err" width={10} stroke={C.text} strokeWidth={1.5} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (type === "grouped") {
    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chart.data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="label" tick={tick} interval={0} />
          <YAxis tick={tick} unit="%" domain={[0, 100]} label={axisLabel(chart.yLabel, -90)} width={64} />
          <Tooltip {...tip} cursor={{ fill: mix(C.border, "55") }} formatter={v => `${fmt(v, 1)}%`} />
          <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
          {chart.keys.map((k, i) => <Bar key={k} dataKey={k} fill={PALETTE[i % PALETTE.length]} radius={[3, 3, 0, 0]} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (type === "scatter") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 8, right: 12, bottom: 24, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis type="number" dataKey="x" name={chart.xLabel} tick={tick} domain={["auto", "auto"]} label={axisLabel(chart.xLabel)} />
          <YAxis type="number" dataKey="y" name={chart.yLabel} tick={tick} domain={["auto", "auto"]} label={axisLabel(chart.yLabel, -90)} width={64} />
          <Tooltip {...tip} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={chart.points} fill={C.accent} fillOpacity={0.55} isAnimationActive={false} />
          {chart.line && <Scatter data={chart.line} line={{ stroke: C.yellow, strokeWidth: 2 }} shape={() => null} legendType="none" isAnimationActive={false} />}
        </ScatterChart>
      </ResponsiveContainer>
    );
  }
  if (type === "roc") {
    const pct = v => `${Math.round(v * 100)}%`;
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 26, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis type="number" dataKey="x" domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tickFormatter={pct} tick={tick} label={axisLabel("1 − Specificity (false positive rate)")} />
          <YAxis type="number" dataKey="y" domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} tickFormatter={pct} tick={tick} label={axisLabel("Sensitivity", -90)} width={58} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke={C.muted} strokeDasharray="4 4" />
          <Tooltip {...tip} formatter={(v, n) => [pct(v), n === "x" ? "1 − Specificity" : "Sensitivity"]} />
          <Scatter data={chart.points} line={{ stroke: C.accent, strokeWidth: 2.5 }} shape={() => null} isAnimationActive={false} />
          <ReferenceDot x={chart.best.x} y={chart.best.y} r={6} fill={C.green} stroke={C.card} strokeWidth={2} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }
  if (type === "km") {
    const xmax = Math.max(...chart.series.flatMap(s => s.points.map(p => p.x)));
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 26, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis type="number" dataKey="x" domain={[0, xmax]} tick={tick} label={axisLabel(chart.xLabel)} />
          <YAxis type="number" dataKey="y" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={v => `${v * 100}%`} tick={tick} label={axisLabel("Survival probability", -90)} width={58} />
          <ReferenceLine y={0.5} stroke={C.muted} strokeDasharray="4 4" />
          <Tooltip {...tip} formatter={(v, n) => (n === "y" ? [`${fmt(v * 100, 1)}%`, "Survival"] : [fmt(v, 2), "Time"])} />
          {chart.series.length > 1 && <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11, color: C.muted }} />}
          {chart.series.map((sr, i) => <Scatter key={sr.label} name={sr.label} data={sr.points} fill={PALETTE[i % PALETTE.length]} line={{ stroke: PALETTE[i % PALETTE.length], strokeWidth: 2 }} shape={() => null} isAnimationActive={false} />)}
        </ScatterChart>
      </ResponsiveContainer>
    );
  }
  if (type === "forest") {
    if (!chart.data.length) return null;
    const data = chart.data.map(d => ({ ...d, err: [d.or - d.lo, d.hi - d.or] }));
    const lo = Math.min(...data.map(d => d.lo), 1), hi = Math.max(...data.map(d => d.hi), 1);
    const dom = [lo / 1.3, hi * 1.3];
    const ticks = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200].filter(t => t >= dom[0] && t <= dom[1]);
    const yw = Math.min(150, 12 + 7 * Math.max(...data.map(d => d.label.length)));
    return (
      <ResponsiveContainer width="100%" height={60 + data.length * 36}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis type="number" dataKey="or" scale="log" domain={dom} ticks={ticks} allowDataOverflow tick={tick} tickFormatter={v => String(v)} label={axisLabel("Adjusted OR (log scale)")} />
          <YAxis type="category" dataKey="label" tick={{ ...tick, fill: C.text }} width={yw} interval={0} reversed allowDuplicatedCategory={false} />
          <ReferenceLine x={1} stroke={C.muted} strokeDasharray="4 4" />
          <Tooltip {...tip} formatter={(v, n, p) => (n === "or" || n === "Adjusted odds ratio" ? [`${fmt(p.payload.or)} (${fmt(p.payload.lo)} to ${fmt(p.payload.hi)})`, "AOR (95% CI)"] : [v, n])} />
          <Scatter data={data} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={d.sig ? C.green : C.muted} />)}
            <ErrorBar dataKey="err" direction="x" width={6} stroke={C.text} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    );
  }
  return null;
}
