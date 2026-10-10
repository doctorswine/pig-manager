"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
import { readStoredFarrowingRecords } from "../../production/sows/_data/farrowing-records";
import { readStoredMatingRecords } from "../../production/sows/_data/mating-records";
import { readStoredWeaningRecords } from "../../production/sows/_data/weaning-records";
import styles from "../../production/sows/intake/page.module.css";
import { dailyPeriods, PeriodUnit } from "../_data/mating-results";
import { buildMatingTarget, MatingTargetRow, MatingTargetSummary, MatingTargets } from "../_data/mating-target";
import ReportShell from "./report-shell";

type Query = { farrowingTarget: string; farrowingRate: string; weanedPerLitter: string; periodCount: string; unitCount: string; unit: PeriodUnit; endDate: string };
const unitLabels: Record<PeriodUnit, string> = { day: "일", week: "주", month: "월", year: "년" };
const SETTINGS_KEY = "pig-manager:mating-target-settings";
const INITIAL_QUERY: Query = { farrowingTarget: "", farrowingRate: "", weanedPerLitter: "", periodCount: "12", unitCount: "1", unit: "week", endDate: "" };
// 그래프 계열: 검증된 범주형 팔레트 1~4번(고정 순서). 분만율은 점선으로 한 번 더 구분한다.
const SERIES = [
  { key: "matingVsTarget", label: "교배목표대비", color: "#2a78d6", dash: "" },
  { key: "farrowingVsTarget", label: "분만목표대비", color: "#eb6834", dash: "" },
  { key: "weanedVsTarget", label: "이유목표대비", color: "#1baf7a", dash: "" },
  { key: "farrowingRate", label: "분만율", color: "#eda100", dash: "5 4" },
] as const;
type SeriesKey = (typeof SERIES)[number]["key"];

function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function parseTarget(value: string) { const parsed = Number(value); return value.trim() !== "" && Number.isFinite(parsed) && parsed > 0 ? parsed : null; }
function show(value: number | null | undefined) { return value === null || value === undefined ? "" : value.toLocaleString("ko-KR"); }
function readSettings(): Partial<Query> { try { const stored = window.localStorage.getItem(SETTINGS_KEY); return stored ? JSON.parse(stored) as Partial<Query> : {}; } catch { return {}; } }
function writeSettings(query: Query) { try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ farrowingTarget: query.farrowingTarget, farrowingRate: query.farrowingRate, weanedPerLitter: query.weanedPerLitter })); } catch { /* 저장소를 쓸 수 없으면 기억하지 않는다 */ } }

function TargetChart({ rows }: { rows: MatingTargetRow[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const width = 960; const height = 320; const left = 44; const right = 16; const top = 16; const bottom = 54;
  const plotWidth = width - left - right; const plotHeight = height - top - bottom;
  const values = rows.flatMap((row) => SERIES.map((series) => row[series.key as SeriesKey])).filter((value): value is number => value !== null);
  const max = Math.max(120, Math.ceil(Math.max(0, ...values) / 20) * 20);
  const x = (index: number) => left + (rows.length <= 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
  const y = (value: number) => top + plotHeight - (value / max) * plotHeight;
  const ticks = Array.from({ length: max / 20 + 1 }, (_, index) => index * 20);
  const labelEvery = Math.max(1, Math.ceil(rows.length / 13));
  const onMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect(); if (!rect || !rows.length) return;
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const index = rows.length <= 1 ? 0 : Math.round(((px - left) / plotWidth) * (rows.length - 1));
    setHover(Math.min(rows.length - 1, Math.max(0, index)));
  };
  const tooltipLeft = (() => { if (hover === null) return 0; const rect = svgRef.current?.getBoundingClientRect(); const ratio = rect ? rect.width / width : 1; const px = x(hover) * ratio; const container = svgRef.current?.parentElement?.clientWidth ?? width; return px + 220 > container ? Math.max(0, px - 216) : px + 14; })();
  return <div style={{ position: "relative" }}>
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="교배·분만·이유 목표대비와 분만율 추이" style={{ width: "100%", display: "block" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      {ticks.map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke={tick === 100 ? "#9aa9a3" : "#e3ebe7"} strokeWidth={1} strokeDasharray={tick === 100 ? "4 3" : undefined} /><text x={left - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill="#6c7c76">{tick}</text></g>)}
      <text x={width - right} y={y(100) - 5} textAnchor="end" fontSize={10} fill="#52635d">목표 100%</text>
      {rows.map((row, index) => (index % labelEvery === 0 && rows.length - 1 - index >= Math.ceil(labelEvery * 0.7)) || index === rows.length - 1 || (labelEvery === 1) ? <text key={row.label} x={x(index)} y={height - bottom + 18} textAnchor="middle" fontSize={10} fill="#52635d">{row.label}</text> : null)}
      <text x={left} y={height - 8} fontSize={10} fill="#6c7c76">단위: %</text>
      {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={top} y2={top + plotHeight} stroke="#9aa9a3" strokeWidth={1} /> : null}
      {SERIES.map((series) => {
        // 값이 없는 구간(분만예정일 전 코호트)은 선을 끊는다.
        const segments: string[][] = []; let current: string[] = [];
        rows.forEach((row, index) => { const value = row[series.key as SeriesKey]; if (value === null) { if (current.length) segments.push(current); current = []; } else current.push(`${x(index)},${y(value)}`); });
        if (current.length) segments.push(current);
        return <g key={series.key}>
          {segments.map((points, index) => points.length > 1 ? <polyline key={index} points={points.join(" ")} fill="none" stroke={series.color} strokeWidth={2} strokeDasharray={series.dash || undefined} strokeLinejoin="round" /> : null)}
          {rows.map((row, index) => { const value = row[series.key as SeriesKey]; return value === null ? null : <circle key={index} cx={x(index)} cy={y(value)} r={hover === index ? 5 : 3.5} fill={series.color} stroke="#fff" strokeWidth={2} />; })}
        </g>;
      })}
    </svg>
    {hover !== null ? <div role="tooltip" style={{ position: "absolute", left: tooltipLeft, top: 8, width: 206, padding: "10px 12px", background: "#fff", border: "1px solid #dce5e1", borderRadius: 10, boxShadow: "0 6px 18px rgba(20,40,34,.12)", fontSize: 12, pointerEvents: "none" }}>
      <strong style={{ display: "block", marginBottom: 4 }}>{rows[hover].label}</strong>
      <span style={{ display: "block", color: "#6c7c76", marginBottom: 6 }}>{rows[hover].start} ~ {rows[hover].end}</span>
      {SERIES.map((series) => <div key={series.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}><span style={{ width: 12, height: 3, background: series.color }} />{series.label}<span style={{ marginLeft: "auto", fontWeight: 700 }}>{rows[hover][series.key as SeriesKey] === null ? "—" : `${rows[hover][series.key as SeriesKey]}%`}</span></div>)}
    </div> : null}
  </div>;
}

export default function MatingTargetReportPage() {
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [result, setResult] = useState<{ rows: MatingTargetRow[]; summary: MatingTargetSummary; start: string; end: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  // 목표값은 이 브라우저에 기억해 두고, 날짜 기본값은 화면이 열린 뒤 오늘로 채운다.
  useEffect(() => { const stored = readSettings(); const withDefaults = (query: Query) => ({ ...query, ...stored, endDate: localToday() }); setDraftQuery(withDefaults); setAppliedQuery(withDefaults); }, []);

  useEffect(() => {
    const q = appliedQuery; if (!q.endDate) return;
    const periods = dailyPeriods(q.endDate, Number(q.periodCount), Number(q.unitCount), q.unit, 30);
    const targets: MatingTargets = { farrowingTarget: parseTarget(q.farrowingTarget), farrowingRate: parseTarget(q.farrowingRate), weanedPerLitter: parseTarget(q.weanedPerLitter) };
    const built = buildMatingTarget(periods, targets, readStoredMatingRecords(), readStoredFarrowingRecords(), readStoredWeaningRecords());
    setResult({ ...built, start: periods[0]?.start ?? "", end: periods.at(-1)?.end ?? "" });
  }, [appliedQuery]);

  // 산출 기준일: 종료일과 기간수·단위로 시작일을 자동 계산한다.
  const draftStart = draftQuery.endDate ? dailyPeriods(draftQuery.endDate, Number(draftQuery.periodCount), Number(draftQuery.unitCount), draftQuery.unit, 30)[0]?.start ?? "" : "";
  function update<K extends keyof Query>(key: K, value: Query[K]) { setDraftQuery((query) => ({ ...query, [key]: value })); }
  function applyQuery() {
    if (!draftQuery.endDate) { setMessage("산출 기준일(종료일)을 선택하세요."); return; }
    const rate = parseTarget(draftQuery.farrowingRate); if (rate !== null && rate > 100) { setMessage("목표분만율은 100% 이하로 입력하세요."); return; }
    setAppliedQuery(draftQuery); writeSettings(draftQuery); setMessage("");
  }

  async function downloadExcel() {
    if (!result) return;
    setExporting(true); setMessage("");
    try {
      const response = await fetch("/api/reports/mating-target/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: result.rows, summary: result.summary, start: result.start, end: result.end, query: appliedQuery, farmName: "참든팜" }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `교배목표달성율_${result.start}_${result.end}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const s = result?.summary;
  const numberInput = (key: "farrowingTarget" | "farrowingRate" | "weanedPerLitter", label: string, suffix: string, placeholder: string) => <label className={styles.field}><span className={styles.fieldLabel}>{label}</span><div style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="number" min={0} step="0.1" value={draftQuery[key]} placeholder={placeholder} onChange={(event) => update(key, event.target.value)} /><span style={{ fontSize: 13, color: "#52635d", whiteSpace: "nowrap" }}>{suffix}</span></div></label>;
  const cell = { textAlign: "right" as const, padding: "0 12px", height: 32, fontSize: 12 };
  const head = { textAlign: "center" as const, padding: "0 10px", fontSize: 12, whiteSpace: "nowrap" as const };
  const foot = { ...cell, fontWeight: 800, background: "#f3f7f5" };
  const unitText = `${draftQuery.unitCount}${unitLabels[draftQuery.unit]}`;

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 교배</p><h1>교배목표 달성율</h1><span>농장 목표(분만복수·분만율·복당이유두수)를 입력하면 구간별 교배·분만·이유 성적과 목표 달성율을 표와 그래프로 보여줍니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>교배목표 달성율 보고서</h2><p>목표는 구간(배치) 1개 기준입니다. 비워 둔 목표는 목표대비를 계산하지 않으며, 입력한 목표는 이 브라우저에 기억합니다.</p></div></div><span className={styles.newBadge}>생산 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        {numberInput("farrowingTarget", "분만목표", "복수", "예: 10")}
        {numberInput("farrowingRate", "목표분만율", "%", "예: 85")}
        {numberInput("weanedPerLitter", "복당목표이유", "두", "예: 11")}
        <div /><div />
        <label className={styles.field}><span className={styles.fieldLabel}>기간수</span><select value={draftQuery.periodCount} onChange={(event) => update("periodCount", event.target.value)}>{Array.from({ length: 52 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>단위</span><div style={{ display: "flex", gap: 8 }}><select value={draftQuery.unitCount} onChange={(event) => update("unitCount", event.target.value)}>{Array.from({ length: 30 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value.padStart(2, "0")}</option>)}</select><select value={draftQuery.unit} onChange={(event) => update("unit", event.target.value as PeriodUnit)}>{Object.entries(unitLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></label>
        <label className={styles.field}><span className={styles.fieldLabel}>산출 기준일 (시작 · 자동)</span><input type="date" value={draftStart} readOnly disabled aria-label="산출 시작일(기간수·단위로 자동 계산)" /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>산출 기준일 (종료)</span><input type="date" value={draftQuery.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting || !result} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6c7c76" }}>산출 기준일은 종료일을 마지막으로 {draftQuery.periodCount}개 구간 × {unitText}만큼 자동으로 맞춰집니다{draftStart ? ` (${draftStart} ~ ${draftQuery.endDate})` : ""}.</p>
      {message ? <p className={styles.exportError}>{message}</p> : null}</div>
    </section>

    {result && s ? <>
      <section className={styles.listCard}>
        <div className={styles.printReportHead}><strong>참든팜</strong><h1>교배목표 달성율</h1><p>산출기간 {result.start} ~ {result.end}</p></div>
        <div className={styles.listHead}><div><h2>목표 설정</h2><p>산출기간 {result.start} ~ {result.end} · 배치 {appliedQuery.unitCount}{unitLabels[appliedQuery.unit]} · {result.rows.length}개 구간</p></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, padding: "0 20px 18px" }}>
          {[["목표분만", appliedQuery.farrowingTarget ? `${appliedQuery.farrowingTarget} 복당` : "미입력"], ["목표분만율", appliedQuery.farrowingRate ? `${appliedQuery.farrowingRate} %` : "미입력"], ["목표교배", s.matingTarget ? `${Math.round(s.matingTarget * 10) / 10} 복당` : "-"], ["복당목표이유", appliedQuery.weanedPerLitter ? `${appliedQuery.weanedPerLitter} 두` : "미입력"], ["목표이유 총", s.weanedTarget ? `${s.weanedTarget} 두` : "-"]].map(([label, value]) => <div key={label} style={{ padding: "12px 14px", border: "1px solid #dce5e1", borderRadius: 10, background: "#f8faf9" }}><span style={{ display: "block", fontSize: 12, color: "#6c7c76" }}>{label}</span><strong style={{ display: "block", marginTop: 4, fontSize: 16, color: "#17231f" }}>{value}</strong></div>)}
        </div>
      </section>

      <section className={styles.listCard} style={{ marginTop: 16 }}>
        <div className={styles.listHead}><div><h2>목표대비 추이</h2><p>교배목표대비·분만목표대비·이유목표대비와 분만율(%)입니다. 분만예정일이 산출 종료일보다 늦은 구간은 분만·이유 결과가 아직 없어 선을 그리지 않습니다.</p></div></div>
        <div style={{ padding: "0 20px 8px", display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 12, color: "#283a34" }} aria-label="범례">{SERIES.map((series) => <span key={series.key} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><svg width="22" height="10" aria-hidden="true"><line x1="0" x2="22" y1="5" y2="5" stroke={series.color} strokeWidth="2" strokeDasharray={series.dash || undefined} /><circle cx="11" cy="5" r="3.5" fill={series.color} /></svg>{series.label}</span>)}</div>
        <div style={{ padding: "4px 20px 20px" }}><TargetChart rows={result.rows} /></div>
      </section>

      <section className={styles.listCard} style={{ marginTop: 16 }}>
        <div className={styles.listHead}><div><h2>구간별 성적</h2><p>분만·이유는 그 구간에 교배한 모돈의 결과입니다(교배 후 다음 교배 전 첫 분만과 그 분만의 이유 두수).</p></div><strong>교배 {s.totals.matings}복</strong></div>
        <div className={styles.tableWrap}><table className={styles.reportTable} style={{ minWidth: 0 }}><thead><tr>
          <th style={head}>구간</th><th style={head}>기간</th><th style={head}>교배복수</th><th style={head}>교배목표대비(%)</th><th style={head}>분만복수</th><th style={head}>분만목표대비(%)</th><th style={head}>분만율(%)</th><th style={head}>이유자돈</th><th style={head}>이유목표대비(%)</th>
        </tr></thead><tbody>{result.rows.map((row) => <tr key={row.label}>
          <td style={{ ...cell, textAlign: "center", fontWeight: 700 }}>{row.label}</td><td style={{ ...cell, textAlign: "center", color: "#6c7c76" }}>{row.start} ~ {row.end}</td>
          <td style={cell}>{show(row.matings)}</td><td style={cell}>{show(row.matingVsTarget)}</td>
          <td style={cell}>{row.matured ? show(row.farrowings) : <span style={{ color: "#9aa9a3" }}>분만 전</span>}</td><td style={cell}>{show(row.farrowingVsTarget)}</td><td style={cell}>{show(row.farrowingRate)}</td>
          <td style={cell}>{row.matured ? show(row.weaned) : ""}</td><td style={cell}>{show(row.weanedVsTarget)}</td>
        </tr>)}</tbody><tfoot>
          <tr><td colSpan={2} style={{ ...foot, textAlign: "center" }}>계</td><td style={foot}>{show(s.totals.matings)}</td><td style={foot}>{show(s.totals.matingVsTarget)}</td><td style={foot}>{show(s.totals.farrowings)}</td><td style={foot}>{show(s.totals.farrowingVsTarget)}</td><td style={foot}>{show(s.totals.farrowingRate)}</td><td style={foot}>{show(s.totals.weaned)}</td><td style={foot}>{show(s.totals.weanedVsTarget)}</td></tr>
          <tr><td colSpan={2} style={{ ...foot, textAlign: "center" }}>표준편차</td><td style={foot} /><td style={foot}>{show(s.stdDev.matingVsTarget)}</td><td style={foot} /><td style={foot}>{show(s.stdDev.farrowingVsTarget)}</td><td style={foot} /><td style={foot} /><td style={foot}>{show(s.stdDev.weanedVsTarget)}</td></tr>
          <tr><td colSpan={2} style={{ ...foot, textAlign: "center" }}>분산</td><td style={foot} /><td style={foot}>{show(s.variance.matingVsTarget)}</td><td style={foot} /><td style={foot}>{show(s.variance.farrowingVsTarget)}</td><td style={foot} /><td style={foot} /><td style={foot}>{show(s.variance.weanedVsTarget)}</td></tr>
        </tfoot></table></div>
        <p className={styles.printHidden} style={{ margin: "10px 18px 16px", fontSize: 12, color: "#6c7c76", lineHeight: 1.6 }}>목표교배 = 분만목표 ÷ 목표분만율, 목표이유 = 분만목표 × 복당목표이유. 교배·분만·이유 목표대비 = 실적 ÷ 목표 × 100, 분만율 = 분만복수 ÷ 교배복수 × 100. 계의 분만·이유는 결과가 나온 구간만 합하며, 표준편차·분산은 구간별 목표대비(%) 값으로 계산합니다.</p>
      </section>
    </> : null}
  </ReportShell>;
}
