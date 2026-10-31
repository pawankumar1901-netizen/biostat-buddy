import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ErrorBar,
  ScatterChart, Scatter, ReferenceLine, Legend, LabelList,
} from "recharts";
import { C, PALETTE, mix } from "./theme.js";
import { fmt } from "../lib/format.js";

const tip = { contentStyle: { background: C.card, border: `1px solid ${C.border}`, fontSize: 12, color: C.text }, labelStyle: { color: C.text }, itemStyle: { color: C.text } };
const tick = { fill: C.muted, fontSize: 11 };
const axisLabel = (value, angle = 0) => ({ value, angle, fill: C.muted, fontSize: 11, position: angle ? "insideLeft" : "insideBottom", offset: angle ? 10 : -4, style: { textAnchor: "middle" } });

export default function ChartView({ chart }) {
  if (!chart) return null;
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
