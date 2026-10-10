"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readStoredIntakeRecords } from "../../production/sows/_data/intake-records";
import { readStoredMatingRecords } from "../../production/sows/_data/mating-records";
import { readStoredPregnancyIncidentRecords } from "../../production/sows/_data/pregnancy-incident-records";
import { readStoredWeaningRecords } from "../../production/sows/_data/weaning-records";
import styles from "../../production/sows/intake/page.module.css";
import { buildMatingResults, classifyMatings, dailyPeriods, MatingPeriod, MatingResultRow, PeriodUnit, seriesPeriods } from "../_data/mating-results";
import ReportShell from "./report-shell";

type ReportType = "daily" | "series";
type Query = { reportType: ReportType; periodCount: string; unitCount: string; unit: PeriodUnit; baseDate: string; baseYear: string; baseMonth: string };

const reportTypeLabels: Record<ReportType, string> = { daily: "일자별 교배실적", series: "시계열 교배실적" };
const unitLabels: Record<PeriodUnit, string> = { day: "일", week: "주", month: "월", year: "년" };
const INITIAL_QUERY: Query = { reportType: "daily", periodCount: "12", unitCount: "1", unit: "month", baseDate: "", baseYear: "", baseMonth: "" };

function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
export function formatMatingValue(row: Pick<MatingResultRow, "kind" | "digits">, value: number | null, isRatio = false) {
  if (value === null || value === undefined) return "";
  if (!isRatio && row.kind === "count" && value === 0) return "";
  const digits = isRatio ? 1 : row.kind === "count" ? (Number.isInteger(value) ? 0 : 1) : row.digits ?? 1;
  return value.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function MatingResultsReportPage() {
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [result, setResult] = useState<{ periods: MatingPeriod[]; rows: MatingResultRow[]; start: string; end: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  // 날짜 기본값은 화면이 열린 뒤 브라우저 날짜로 채운다.
  useEffect(() => {
    const today = localToday();
    const withDates = (query: Query) => ({ ...query, baseDate: today, baseYear: today.slice(0, 4), baseMonth: String(Number(today.slice(5, 7))) });
    setDraftQuery(withDates); setAppliedQuery(withDates);
  }, []);

  useEffect(() => {
    const q = appliedQuery;
    if (!q.baseDate) return;
    const periods = q.reportType === "daily" ? dailyPeriods(q.baseDate, Number(q.periodCount), Number(q.unitCount), q.unit) : seriesPeriods(Number(q.baseYear), Number(q.baseMonth));
    const classified = classifyMatings(readStoredMatingRecords(), readStoredPregnancyIncidentRecords(), readStoredIntakeRecords(), readStoredWeaningRecords());
    const built = buildMatingResults(classified, periods, { withSummary: q.reportType === "daily" });
    setResult({ periods, ...built });
  }, [appliedQuery]);

  function update<K extends keyof Query>(key: K, value: Query[K]) { setDraftQuery((query) => ({ ...query, [key]: value })); }
  function applyQuery() { if (draftQuery.reportType === "daily" && !draftQuery.baseDate) { setMessage("조회기준일을 선택하세요."); return; } setAppliedQuery(draftQuery); setMessage(""); }

  async function downloadExcel() {
    if (!result) return;
    setExporting(true); setMessage("");
    try {
      const response = await fetch("/api/reports/mating-results/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportType: appliedQuery.reportType, periods: result.periods, rows: result.rows, start: result.start, end: result.end, farmName: "참든팜" }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${reportTypeLabels[appliedQuery.reportType].replace(/ /g, "")}_${result.start}_${result.end}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const isDaily = appliedQuery.reportType === "daily";
  const years = useMemo(() => { const now = Number(localToday().slice(0, 4)); return Array.from({ length: 12 }, (_, index) => String(now + 1 - index)); }, []);
  // 같은 구분(차수·방법 등)끼리 첫 열을 세로로 합친다.
  const groupSpans = useMemo(() => {
    const spans: number[] = []; const rows = result?.rows ?? [];
    rows.forEach((row, index) => { if (row.group && index > 0 && rows[index - 1].group === row.group) { spans.push(0); let first = index; while (first > 0 && rows[first - 1].group === row.group) first -= 1; spans[first] += 1; } else spans.push(row.group ? 1 : 0); });
    return spans;
  }, [result]);
  const cellStyle = { textAlign: "right" as const, whiteSpace: "nowrap" as const, padding: "0 10px", height: 30, fontSize: 12 };
  const headStyle = { textAlign: "center" as const, whiteSpace: "nowrap" as const, padding: "0 10px", height: 36, fontSize: 12 };
  const groupStyle = { textAlign: "center" as const, fontWeight: 800, background: "#f3f7f5", writingMode: "vertical-rl" as const, letterSpacing: 2, padding: "6px 4px", minWidth: 34, fontSize: 12, borderRight: "1px solid #edf1ef" };
  const labelStyle = { textAlign: "left" as const, fontWeight: 700, whiteSpace: "nowrap" as const, background: "#f8faf9", padding: "0 12px", height: 30, fontSize: 12 };
  const summaryStyle = { ...cellStyle, fontWeight: 800, background: "#f3f7f5" };

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 교배</p><h1>교배실적</h1><span>교배 기록을 차수·방법·발정구분·미경산/경산·재귀일 분포로 집계합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>교배실적 보고서</h2><p>{draftQuery.reportType === "daily" ? "기간 수와 단위를 고르면 조회기준일을 마지막으로 구간을 나눠 집계합니다." : "조회기준 연도·월을 끝으로 1년·9개월·6개월·3개월·당월 누계를 비교합니다."}</p></div></div><span className={styles.newBadge}>생산 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서구분</span><select value={draftQuery.reportType} onChange={(event) => update("reportType", event.target.value as ReportType)}>{Object.entries(reportTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {draftQuery.reportType === "daily" ? <>
          <label className={styles.field}><span className={styles.fieldLabel}>기간</span><select value={draftQuery.periodCount} onChange={(event) => update("periodCount", event.target.value)}>{Array.from({ length: 52 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className={styles.field}><span className={styles.fieldLabel}>단위</span><div style={{ display: "flex", gap: 8 }}><select value={draftQuery.unitCount} onChange={(event) => update("unitCount", event.target.value)}>{Array.from({ length: 12 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={draftQuery.unit} onChange={(event) => update("unit", event.target.value as PeriodUnit)}>{Object.entries(unitLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></label>
          <label className={styles.field}><span className={styles.fieldLabel}>조회기준일</span><input type="date" value={draftQuery.baseDate} onChange={(event) => update("baseDate", event.target.value)} /></label>
        </> : <>
          <label className={styles.field}><span className={styles.fieldLabel}>조회기준 연도</span><select value={draftQuery.baseYear} onChange={(event) => update("baseYear", event.target.value)}>{years.map((year) => <option key={year} value={year}>{year}년</option>)}</select></label>
          <label className={styles.field}><span className={styles.fieldLabel}>조회기준 월</span><select value={draftQuery.baseMonth} onChange={(event) => update("baseMonth", event.target.value)}>{Array.from({ length: 12 }, (_, index) => String(index + 1)).map((month) => <option key={month} value={month}>{month}월</option>)}</select></label>
          <div />
        </>}
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting || !result} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{message ? <p className={styles.exportError}>{message}</p> : null}</div>
    </section>

    {result ? <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>교배실적</h1><p>{reportTypeLabels[appliedQuery.reportType]} · 조회기간 {result.start} ~ {result.end}</p></div>
      <div className={styles.listHead}><div><h2>{reportTypeLabels[appliedQuery.reportType]}</h2><p>조회기간 {result.start} ~ {result.end}{isDaily ? ` · ${appliedQuery.periodCount}개 구간 × ${appliedQuery.unitCount}${unitLabels[appliedQuery.unit]}` : ""}</p></div><strong>교배복수 {formatMatingValue(result.rows[0], isDaily ? result.rows[0].total : result.rows[0].values[0]) || 0}</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable} style={{ minWidth: 0 }}><thead><tr>
        <th colSpan={2} style={headStyle}>구분</th>{result.periods.map((period) => <th key={period.label} style={headStyle}>{period.label}</th>)}
        {isDaily ? <><th style={headStyle}>합계</th><th style={headStyle}>평균</th><th style={headStyle}>비율(%)</th></> : <th style={headStyle}>목표</th>}
      </tr></thead><tbody>{result.rows.map((row, index) => <tr key={row.key} style={row.key === "total" || row.key === "returnWithin7" ? { fontWeight: 800 } : undefined}>
        {row.group ? (groupSpans[index] ? <td rowSpan={groupSpans[index]} style={groupStyle}>{row.group}</td> : null) : null}
        <td colSpan={row.group ? 1 : 2} style={labelStyle}>{row.label}</td>
        {row.values.map((value, valueIndex) => <td key={valueIndex} style={cellStyle}>{formatMatingValue(row, value)}</td>)}
        {isDaily ? <><td style={summaryStyle}>{formatMatingValue(row, row.total)}</td><td style={summaryStyle}>{formatMatingValue(row, row.average)}</td><td style={summaryStyle}>{row.ratio === null ? "" : formatMatingValue(row, row.ratio, true)}</td></> : <td style={cellStyle} />}
      </tr>)}</tbody></table></div>
      <p className={styles.printHidden} style={{ margin: "10px 18px 16px", fontSize: 12, color: "#6c7c76", lineHeight: 1.6 }}>
        차수는 한 번의 교배에 기록한 웅돈 수(1~3회), 방법은 웅돈별 인공·자연 기록으로 나눕니다. 발정구분은 같은 산차의 이전 교배 뒤 임신사고 원인으로 정하며, 재발(또는 사고 기록 없이 재교배)은 1차재발·2차재발, 그 밖의 사고 뒤 교배는 기타사고후교배입니다. 초교배일은 후보돈 정상교배의 출생일→교배일, 평균재귀일과 재귀일분포는 경산돈 정상교배의 최근 이유일→교배일 일수입니다. 재귀율은 재귀일을 아는 경산돈 정상교배 대비, 비율(%)은 교배복수(미경산돈·경산돈 행은 각 합계) 대비입니다.{isDaily ? " 평균·재귀율 행의 합계는 전체 기간으로 다시 계산한 값입니다." : " 목표는 교배목표 달성율 보고서에서 정한 뒤 연결합니다."}
      </p>
    </section> : null}
  </ReportShell>;
}
