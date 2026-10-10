"use client";

import { BarChart3, Download, FileText, Printer, Search, Table2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { readStoredCullRecords } from "../../production/sows/_data/cull-records";
import { readStoredIntakeRecords } from "../../production/sows/_data/intake-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

type ViewMode = "table" | "chart";
type CullKind = "all" | "도태" | "폐사";
export type GroupBy = "month" | "year" | "parity" | "breed";
type Query = { view: ViewMode; startDate: string; endDate: string; kind: CullKind; groupBy: GroupBy };
export type CullAnalysis = {
  groups: string[];
  causes: string[];
  counts: Record<string, Record<string, number>>; // cause -> group -> 두수
  causeTotals: Record<string, number>;
  groupTotals: Record<string, number>;
  total: number;
  typeSummary: Array<{ type: string; count: number }>;
};

// 모돈 도폐사관리의 원인 순서. 그 밖의 원인이나 빈 값은 "기타"로 모은다.
export const CULL_CAUSES = ["고령/노산", "번식장애", "지제이상/기립불능", "산자수 저하", "포유성적 저하", "기타"];
// 이 보고서의 "전체"는 도태+폐사만 포함한다(전출·판매 제외).
const CULL_TYPES = ["도태", "폐사"];
// 범주형 색상(검증된 기본 팔레트 1~6번, 고정 순서)
const CAUSE_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"];
export const kindLabels: Record<CullKind, string> = { all: "전체", "도태": "도태", "폐사": "폐사" };
export const groupByLabels: Record<GroupBy, string> = { month: "월별", year: "연도별", parity: "산차별", breed: "품종별" };

function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function percent(value: number, total: number) { return total ? Math.round((value / total) * 1000) / 10 : 0; }
function monthsBetween(start: string, end: string) {
  const result: string[] = []; let year = Number(start.slice(0, 4)); let month = Number(start.slice(5, 7));
  const endKey = end.slice(0, 7);
  while (`${year}-${String(month).padStart(2, "0")}` <= endKey && result.length < 240) { result.push(`${year}-${String(month).padStart(2, "0")}`); month += 1; if (month > 12) { month = 1; year += 1; } }
  return result;
}

export function analyzeCulls(startDate: string, endDate: string, kind: CullKind, groupBy: GroupBy): CullAnalysis {
  const intakes = readStoredIntakeRecords();
  const records = readStoredCullRecords().filter((record) => record.eventDate >= startDate && record.eventDate <= endDate && (kind === "all" ? CULL_TYPES.includes(record.type) : record.type === kind));
  const groupOf = (record: (typeof records)[number]) => {
    if (groupBy === "month") return record.eventDate.slice(0, 7);
    if (groupBy === "year") return record.eventDate.slice(0, 4);
    if (groupBy === "parity") return `${Number(record.parity) || 0}산`;
    return record.breed || intakes.find((intake) => intake.animalNo === record.animalNo)?.breed || "미입력";
  };
  const causeOf = (cause: string) => (CULL_CAUSES.includes(cause) ? cause : "기타");

  let groups: string[];
  if (groupBy === "month") groups = monthsBetween(startDate, endDate);
  else if (groupBy === "year") { const from = Number(startDate.slice(0, 4)); const to = Number(endDate.slice(0, 4)); groups = Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => String(from + index)); }
  else if (groupBy === "parity") groups = [...new Set(records.map(groupOf))].sort((left, right) => parseInt(left) - parseInt(right));
  else groups = [...new Set(records.map(groupOf))].sort((left, right) => left.localeCompare(right, "ko"));

  const counts: Record<string, Record<string, number>> = Object.fromEntries(CULL_CAUSES.map((cause) => [cause, Object.fromEntries(groups.map((group) => [group, 0]))]));
  records.forEach((record) => { const group = groupOf(record); const cause = causeOf(record.cause); counts[cause][group] = (counts[cause][group] ?? 0) + 1; });
  const causeTotals = Object.fromEntries(CULL_CAUSES.map((cause) => [cause, groups.reduce((sum, group) => sum + (counts[cause][group] ?? 0), 0)]));
  const groupTotals = Object.fromEntries(groups.map((group) => [group, CULL_CAUSES.reduce((sum, cause) => sum + (counts[cause][group] ?? 0), 0)]));
  const typeSummary = CULL_TYPES.filter((type) => kind === "all" || type === kind).map((type) => ({ type, count: records.filter((record) => record.type === type).length }));
  return { groups, causes: CULL_CAUSES, counts, causeTotals, groupTotals, total: records.length, typeSummary };
}

const INITIAL_QUERY: Query = { view: "table", startDate: "", endDate: "", kind: "all", groupBy: "month" };

// 원인별 비율: 한 계열 가로 막대(전체 대비 %)
function CauseShareChart({ analysis }: { analysis: CullAnalysis }) {
  const [hover, setHover] = useState<string | null>(null);
  const rowHeight = 34; const labelWidth = 130; const width = 720; const barMax = width - labelWidth - 90;
  const max = Math.max(1, ...analysis.causes.map((cause) => analysis.causeTotals[cause]));
  return <svg viewBox={`0 0 ${width} ${analysis.causes.length * rowHeight + 10}`} role="img" aria-label="원인별 도폐사 두수와 비율" style={{ width: "100%", maxWidth: width, display: "block" }}>
    {analysis.causes.map((cause, index) => {
      const value = analysis.causeTotals[cause]; const y = index * rowHeight + 6; const barWidth = value ? Math.max(4, (value / max) * barMax) : 0;
      return <g key={cause} onMouseEnter={() => setHover(cause)} onMouseLeave={() => setHover(null)}>
        <rect x={0} y={y - 4} width={width} height={rowHeight} fill={hover === cause ? "#f1f5f3" : "transparent"} />
        <text x={labelWidth - 10} y={y + 15} textAnchor="end" fontSize={12} fill="#283a34">{cause}</text>
        <rect x={labelWidth} y={y + 4} width={barWidth} height={16} rx={4} fill="#2a78d6" />
        <text x={labelWidth + barWidth + 8} y={y + 16} fontSize={12} fill="#52635d">{value}두 · {percent(value, analysis.total)}%</text>
      </g>;
    })}
  </svg>;
}

// 항목별 원인 구성: 원인별 누적 세로 막대(고정 색상 순서, 세그먼트 사이 2px 간격)
function StackedCauseChart({ analysis }: { analysis: CullAnalysis }) {
  const [hover, setHover] = useState<{ group: string; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const height = 300; const top = 16; const bottom = 46; const left = 40; const plotHeight = height - top - bottom;
  const slot = Math.max(34, Math.min(80, 760 / Math.max(1, analysis.groups.length)));
  const width = left + slot * analysis.groups.length + 16; const barWidth = Math.min(28, slot * 0.55);
  const max = Math.max(1, ...analysis.groups.map((group) => analysis.groupTotals[group]));
  const step = Math.max(1, Math.ceil(max / 4)); const axisMax = step * 4;
  const scale = (value: number) => (value / axisMax) * plotHeight;
  // 툴팁은 실제로 그려진 SVG 크기에 맞춰 막대 오른쪽에 두고, 넘치면 왼쪽으로 옮긴다.
  const tooltipPosition = (point: { x: number; y: number }) => {
    const rendered = svgRef.current?.getBoundingClientRect(); const ratio = rendered ? rendered.width / width : 1;
    const x = point.x * ratio; const containerWidth = svgRef.current?.parentElement?.clientWidth ?? rendered?.width ?? width;
    const left = x + 220 > containerWidth ? Math.max(0, x - 216) : x + 16;
    return { left, top: Math.max(0, point.y * ratio - 10) };
  };
  return <div style={{ position: "relative", overflowX: "auto" }}>
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`항목별 원인 구성 누적 막대`} style={{ width: Math.max(width, 320), maxWidth: "100%", minWidth: Math.min(width, 900), display: "block" }} onMouseLeave={() => setHover(null)}>
      {[0, 1, 2, 3, 4].map((tick) => { const y = top + plotHeight - scale(tick * step); return <g key={tick}><line x1={left} x2={width - 8} y1={y} y2={y} stroke="#e3ebe7" strokeWidth={1} /><text x={left - 6} y={y + 4} textAnchor="end" fontSize={11} fill="#6c7c76">{tick * step}</text></g>; })}
      {analysis.groups.map((group, index) => {
        const x = left + index * slot + (slot - barWidth) / 2; let acc = 0;
        const segments = analysis.causes.map((cause, causeIndex) => ({ cause, value: analysis.counts[cause][group] ?? 0, color: CAUSE_COLORS[causeIndex] })).filter((segment) => segment.value > 0);
        return <g key={group} onMouseEnter={() => setHover({ group, x: left + index * slot + slot / 2, y: top + plotHeight - scale(analysis.groupTotals[group]) })}>
          <rect x={left + index * slot} y={top} width={slot} height={plotHeight} fill={hover?.group === group ? "#f1f5f3" : "transparent"} />
          {segments.map((segment, segmentIndex) => {
            const h = scale(segment.value); const y = top + plotHeight - acc - h; acc += h;
            const isTop = segmentIndex === segments.length - 1;
            return <rect key={segment.cause} x={x} y={y} width={barWidth} height={Math.max(1, h - (isTop ? 0 : 2))} rx={isTop ? 4 : 0} fill={segment.color} />;
          })}
          {analysis.groupTotals[group] ? <text x={x + barWidth / 2} y={top + plotHeight - scale(analysis.groupTotals[group]) - 6} textAnchor="middle" fontSize={11} fill="#283a34">{analysis.groupTotals[group]}</text> : null}
          <text x={x + barWidth / 2} y={height - bottom + 18} textAnchor="middle" fontSize={11} fill="#52635d">{group}</text>
        </g>;
      })}
      <line x1={left} x2={width - 8} y1={top + plotHeight} y2={top + plotHeight} stroke="#9aa9a3" strokeWidth={1} />
    </svg>
    {hover ? <div role="tooltip" style={{ position: "absolute", ...tooltipPosition(hover), width: 200, padding: "10px 12px", background: "#fff", border: "1px solid #dce5e1", borderRadius: 10, boxShadow: "0 6px 18px rgba(20,40,34,.12)", fontSize: 12, pointerEvents: "none", zIndex: 2 }}>
      <strong style={{ display: "block", marginBottom: 6 }}>{hover.group} · 합계 {analysis.groupTotals[hover.group]}두</strong>
      {analysis.causes.map((cause, index) => analysis.counts[cause][hover.group] ? <div key={cause} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, color: "#283a34" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: CAUSE_COLORS[index] }} />{cause}<span style={{ marginLeft: "auto" }}>{analysis.counts[cause][hover.group]}두</span></div> : null)}
    </div> : null}
  </div>;
}

export default function SowCullAnalysisReportPage() {
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [analysis, setAnalysis] = useState<CullAnalysis | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  // 날짜 기본값은 화면이 열린 뒤 브라우저 날짜로 채운다(올해 1월 1일 ~ 오늘).
  useEffect(() => { const today = localToday(); const withDates = (query: Query) => ({ ...query, startDate: `${today.slice(0, 4)}-01-01`, endDate: today }); setDraftQuery(withDates); setAppliedQuery(withDates); }, []);
  useEffect(() => { if (appliedQuery.startDate && appliedQuery.endDate) setAnalysis(analyzeCulls(appliedQuery.startDate, appliedQuery.endDate, appliedQuery.kind, appliedQuery.groupBy)); }, [appliedQuery.startDate, appliedQuery.endDate, appliedQuery.kind, appliedQuery.groupBy]);

  function update<K extends keyof Query>(key: K, value: Query[K]) { setDraftQuery((query) => ({ ...query, [key]: value })); }
  function applyQuery() {
    if (!draftQuery.startDate || !draftQuery.endDate) { setMessage("조회기간을 선택하세요."); return; }
    if (draftQuery.startDate > draftQuery.endDate) { setMessage("조회기간 시작일이 종료일보다 늦습니다."); return; }
    setAppliedQuery(draftQuery); setMessage("");
  }
  // 구분(표·그래프)은 조회 없이 바로 바꿔 보여준다.
  function changeView(view: ViewMode) { setDraftQuery((query) => ({ ...query, view })); setAppliedQuery((query) => ({ ...query, view })); }

  async function downloadExcel() {
    if (!analysis) return;
    setExporting(true); setMessage("");
    try {
      const response = await fetch("/api/reports/sow-cull-analysis/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysis, query: appliedQuery, farmName: "참든팜" }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `모돈도폐사원인분석_${appliedQuery.startDate}_${appliedQuery.endDate}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const headText = `조회기간 ${appliedQuery.startDate} ~ ${appliedQuery.endDate} · 도폐사구분 ${kindLabels[appliedQuery.kind]} · 항목 ${groupByLabels[appliedQuery.groupBy]}`;
  const center = { textAlign: "center" as const };
  const strong = { fontWeight: 800, background: "#eef4f1" };

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 작업지시서</p><h1>모돈 도폐사 원인분석</h1><span>도폐사관리 기록을 원인별로 월별·연도별·산차별·품종별로 나눠 표와 그래프로 분석합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>모돈 도폐사 원인분석 보고서</h2><p>구분, 조회기간(도폐사일), 종류와 항목을 선택하세요. 종류 “전체”는 도태와 폐사를 합한 것입니다(전출·판매 제외).</p></div></div><span className={styles.newBadge}>생산 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>구분</span><select value={draftQuery.view} onChange={(event) => changeView(event.target.value as ViewMode)}><option value="table">표</option><option value="chart">그래프</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>조회기간 시작</span><input type="date" value={draftQuery.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>조회기간 종료</span><input type="date" value={draftQuery.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>종류</span><select value={draftQuery.kind} onChange={(event) => update("kind", event.target.value as CullKind)}>{Object.entries(kindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <div />
        <label className={styles.field}><span className={styles.fieldLabel}>항목</span><select value={draftQuery.groupBy} onChange={(event) => update("groupBy", event.target.value as GroupBy)}>{Object.entries(groupByLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <div /><div /><div />
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting || !analysis} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{message ? <p className={styles.exportError}>{message}</p> : null}</div>
    </section>

    {analysis ? <>
      <section className={styles.listCard}>
        <div className={styles.printReportHead}><strong>참든팜</strong><h1>도폐사 원인 분석</h1><p>{headText}</p></div>
        <div className={styles.listHead}><div><h2>도폐사 구분</h2><p>{headText}</p></div><div style={{ display: "flex", gap: 8, alignItems: "center" }} className={styles.printHidden}>
          <button type="button" className={appliedQuery.view === "table" ? styles.filterButton : styles.filterButton} aria-pressed={appliedQuery.view === "table"} style={appliedQuery.view === "table" ? { background: "#146f5b", color: "#fff", borderColor: "#146f5b" } : undefined} onClick={() => changeView("table")}><Table2 size={15} />표</button>
          <button type="button" className={styles.filterButton} aria-pressed={appliedQuery.view === "chart"} style={appliedQuery.view === "chart" ? { background: "#146f5b", color: "#fff", borderColor: "#146f5b" } : undefined} onClick={() => changeView("chart")}><BarChart3 size={15} />그래프</button>
          <strong style={{ marginLeft: 8 }}>합계 {analysis.total}두</strong></div></div>
        <div className={styles.tableWrap}><table className={styles.reportTable} style={{ maxWidth: 480, minWidth: 0 }}><thead><tr><th>구분</th><th>두수</th><th>비율(%)</th></tr></thead><tbody>
          {analysis.typeSummary.map((row) => <tr key={row.type}><td><strong>{row.type}</strong></td><td>{row.count}</td><td>{percent(row.count, analysis.total)}</td></tr>)}
          <tr style={strong}><td>합계</td><td>{analysis.total}</td><td>{analysis.total ? 100 : 0}</td></tr>
        </tbody></table></div>
      </section>

      {appliedQuery.view === "table" ? <section className={styles.listCard} style={{ marginTop: 16 }}>
        <div className={styles.listHead}><div><h2>원인별 {groupByLabels[appliedQuery.groupBy]} 두수</h2><p>행은 도폐사 원인, 열은 {groupByLabels[appliedQuery.groupBy].replace("별", "")}입니다. 기록이 없는 원인도 0으로 표시합니다.</p></div><strong>{analysis.groups.length}개 {groupByLabels[appliedQuery.groupBy].replace("별", "")}</strong></div>
        <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr><th>구분</th>{analysis.groups.map((group) => <th key={group} style={center}>{group}</th>)}<th style={center}>합계</th><th style={center}>비율(%)</th></tr></thead><tbody>
          {analysis.causes.map((cause) => <tr key={cause}><td><strong>{cause}</strong></td>{analysis.groups.map((group) => <td key={group} style={center}>{analysis.counts[cause][group] ?? 0}</td>)}<td style={{ ...center, fontWeight: 800 }}>{analysis.causeTotals[cause]}</td><td style={center}>{percent(analysis.causeTotals[cause], analysis.total)}</td></tr>)}
          <tr style={strong}><td>합계</td>{analysis.groups.map((group) => <td key={group} style={center}>{analysis.groupTotals[group]}</td>)}<td style={center}>{analysis.total}</td><td style={center}>{analysis.total ? 100 : 0}</td></tr>
        </tbody></table></div>
        {!analysis.groups.length ? <p style={{ padding: "0 20px 18px", color: "#6c7c76", fontSize: 13 }}>조회기간에 해당하는 도폐사 기록이 없습니다.</p> : null}
      </section> : <>
        <section className={styles.listCard} style={{ marginTop: 16 }}>
          <div className={styles.listHead}><div><h2>원인별 비율</h2><p>조회기간 전체 도폐사 {analysis.total}두 중 원인별 두수와 비율입니다.</p></div></div>
          <div style={{ padding: "8px 20px 20px" }}>{analysis.total ? <CauseShareChart analysis={analysis} /> : <p style={{ color: "#6c7c76", fontSize: 13 }}>조회기간에 해당하는 도폐사 기록이 없습니다.</p>}</div>
        </section>
        <section className={styles.listCard} style={{ marginTop: 16 }}>
          <div className={styles.listHead}><div><h2>{groupByLabels[appliedQuery.groupBy]} 원인 구성</h2><p>막대 높이는 두수, 색은 원인입니다. 막대에 마우스를 올리면 원인별 두수가 보입니다.</p></div></div>
          <div style={{ padding: "0 20px 8px", display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 12, color: "#283a34" }} aria-label="범례">{analysis.causes.map((cause, index) => <span key={cause} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: CAUSE_COLORS[index] }} />{cause}</span>)}</div>
          <div style={{ padding: "8px 20px 20px" }}>{analysis.total ? <StackedCauseChart analysis={analysis} /> : <p style={{ color: "#6c7c76", fontSize: 13 }}>조회기간에 해당하는 도폐사 기록이 없습니다.</p>}</div>
        </section>
      </>}
    </> : null}
  </ReportShell>;
}
