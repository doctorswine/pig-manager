"use client";

import { useRef, useState } from "react";

// 여러 보고서가 함께 쓰는 묶음 세로 막대 그래프(축 하나·범례·툴팁). 계열 색은 검증된 범주 팔레트 순서를 따른다.
export const CATEGORY_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"];
export type BarSeries = { name: string; values: Array<number | null>; color?: string; unit?: string }; // unit: 툴팁 단위(계열마다 다를 때)

export default function GroupedBarChart({ categories, series, unit, ariaLabel, showValues = false, emptyText = "표시할 자료가 없습니다." }: { categories: string[]; series: BarSeries[]; unit: string; ariaLabel: string; showValues?: boolean; emptyText?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const height = 290; const top = 30; const bottom = 40; const left = 44; const plotHeight = height - top - bottom;
  const slot = Math.max(44, Math.min(220, 900 / Math.max(1, categories.length))); // 구간이 적으면 넓게
  const width = left + slot * categories.length + 12;
  const gap = 2; const barWidth = Math.min(30, (slot * 0.72 - gap * (series.length - 1)) / Math.max(1, series.length));
  const max = Math.max(0, ...series.flatMap((item) => item.values.map((value) => value ?? 0)));
  const rawStep = max <= 0 ? 1 : max / 4; const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const integerOnly = series.every((item) => item.values.every((value) => value === null || Number.isInteger(value)));
  const niceStep = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((value) => value >= rawStep) ?? rawStep;
  const step = integerOnly ? Math.max(1, Math.ceil(niceStep)) : niceStep; const axisMax = step * 4; // 두수처럼 정수 값은 눈금도 정수로
  const scale = (value: number) => (value / axisMax) * plotHeight;
  const colorOf = (index: number) => series[index].color ?? CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  const format = (value: number) => Number.isInteger(value) ? value.toLocaleString("ko-KR") : value.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  const tooltipLeft = (index: number) => {
    const rendered = svgRef.current?.getBoundingClientRect(); const ratio = rendered ? rendered.width / width : 1;
    const x = (left + index * slot + slot / 2) * ratio; const containerWidth = svgRef.current?.parentElement?.clientWidth ?? width;
    return x + 200 > containerWidth ? Math.max(0, x - 196) : x + 14;
  };
  return <div>
    {series.length > 1 ? <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "0 0 8px", fontSize: 12, color: "#52635d" }}>{series.map((item, index) => <span key={item.name} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: colorOf(index) }} />{item.name}</span>)}</div> : null}
    <div style={{ position: "relative", overflowX: "auto" }}>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} style={{ width: Math.max(width, 320), maxWidth: "100%", minWidth: Math.min(width, 860), display: "block" }} onMouseLeave={() => setHover(null)}>
        {[0, 1, 2, 3, 4].map((tick) => { const y = top + plotHeight - scale(tick * step); return <g key={tick}><line x1={left} x2={width - 8} y1={y} y2={y} stroke="#e3ebe7" strokeWidth={1} /><text x={left - 6} y={y + 4} textAnchor="end" fontSize={11} fill="#6c7c76">{format(tick * step)}</text></g>; })}
        <text x={left - 6} y={top - 14} textAnchor="end" fontSize={11} fill="#6c7c76">({unit})</text>
        {categories.map((category, index) => {
          const groupWidth = series.length * barWidth + gap * (series.length - 1); const start = left + index * slot + (slot - groupWidth) / 2;
          return <g key={category} onMouseEnter={() => setHover(index)}>
            <rect x={left + index * slot} y={top} width={slot} height={plotHeight} fill={hover === index ? "#f1f5f3" : "transparent"} />
            {series.map((item, seriesIndex) => { const value = item.values[index] ?? 0; const h = scale(value); const x = start + seriesIndex * (barWidth + gap); return value > 0 ? <g key={item.name}><rect x={x} y={top + plotHeight - h} width={barWidth} height={Math.max(1, h)} rx={Math.min(4, barWidth / 3)} fill={colorOf(seriesIndex)} />{showValues ? <text x={x + barWidth / 2} y={top + plotHeight - h - 5} textAnchor="middle" fontSize={11} fill="#283a34">{format(value)}</text> : null}</g> : null; })}
            <text x={left + index * slot + slot / 2} y={height - bottom + 18} textAnchor="middle" fontSize={11} fill="#52635d">{category}</text>
          </g>;
        })}
        <line x1={left} x2={width - 8} y1={top + plotHeight} y2={top + plotHeight} stroke="#9aa9a3" strokeWidth={1} />
        {max <= 0 ? <text x={(left + width) / 2} y={top + plotHeight / 2} textAnchor="middle" fontSize={13} fill="#8a9893">{emptyText}</text> : null}
      </svg>
      {hover !== null ? <div role="tooltip" style={{ position: "absolute", left: tooltipLeft(hover), top: 10, width: 180, padding: "10px 12px", background: "#fff", border: "1px solid #dce5e1", borderRadius: 10, boxShadow: "0 6px 18px rgba(20,40,34,.12)", fontSize: 12, pointerEvents: "none", zIndex: 2 }}>
        <strong style={{ display: "block", marginBottom: 6 }}>{categories[hover]}</strong>
        {series.map((item, index) => <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, color: "#283a34" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: colorOf(index) }} />{item.name}<span style={{ marginLeft: "auto" }}>{item.values[hover] === null || item.values[hover] === undefined ? "-" : `${format(item.values[hover]!)}${item.unit ?? unit}`}</span></div>)}
      </div> : null}
    </div>
  </div>;
}
