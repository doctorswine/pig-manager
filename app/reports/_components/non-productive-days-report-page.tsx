"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { readStoredCullRecords } from "../../production/sows/_data/cull-records";
import { readStoredFarrowingRecords } from "../../production/sows/_data/farrowing-records";
import { readStoredIntakeRecords } from "../../production/sows/_data/intake-records";
import { readStoredMatingRecords } from "../../production/sows/_data/mating-records";
import { readStoredPregnancyIncidentRecords } from "../../production/sows/_data/pregnancy-incident-records";
import { readStoredWeaningRecords } from "../../production/sows/_data/weaning-records";
import styles from "../../production/sows/intake/page.module.css";
import { dailyPeriods, MatingPeriod, PeriodUnit } from "../_data/mating-results";
import { breedOptions, buildNonProductiveDays, NpdRow } from "../_data/non-productive-days";
import ReportShell from "./report-shell";

type Query = { breed: string; periodCount: string; unitCount: string; unit: PeriodUnit; endDate: string };
type Cell = string | number | null;

const TITLE = "비생산일수 분석";
const REPORT_LABEL = "비생산일수(기간별)";
const unitLabels: Record<PeriodUnit, string> = { day: "일", week: "주", month: "월", year: "년" };
const INITIAL_QUERY: Query = { breed: "", periodCount: "12", unitCount: "1", unit: "month", endDate: "" };

function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
// 구간 이름: 월 단위는 yy-mm, 년 단위는 yyyy, 그 밖에는 구간 시작일(yy-mm-dd)
const periodHeader = (period: MatingPeriod, unit: PeriodUnit, unitCount: string) => unit === "year" && unitCount === "1" ? period.start.slice(0, 4) : unit === "month" && unitCount === "1" ? period.start.slice(2, 7) : period.start.slice(2);
const rowCells = (row: NpdRow): Cell[] => [row.group, row.label, ...row.values, row.total, row.average, row.ratio];

export default function NonProductiveDaysReportPage() {
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [result, setResult] = useState<{ periods: MatingPeriod[]; rows: NpdRow[]; start: string; end: string; asOf: string; avgGestation: number | null } | null>(null);
  const [breeds, setBreeds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  // 날짜 기본값은 화면이 열린 뒤 오늘로 채운다.
  useEffect(() => { const today = localToday(); setBreeds(breedOptions(readStoredIntakeRecords(), readStoredMatingRecords())); setDraftQuery((query) => ({ ...query, endDate: today })); setAppliedQuery((query) => ({ ...query, endDate: today })); }, []);

  useEffect(() => {
    const q = appliedQuery; if (!q.endDate) return;
    const periods = dailyPeriods(q.endDate, Number(q.periodCount), Number(q.unitCount), q.unit, 30);
    const built = buildNonProductiveDays(periods, q.breed, localToday(), { intakes: readStoredIntakeRecords(), matings: readStoredMatingRecords(), incidents: readStoredPregnancyIncidentRecords(), culls: readStoredCullRecords(), farrowings: readStoredFarrowingRecords(), weanings: readStoredWeaningRecords() });
    setResult({ periods, rows: built.rows, start: periods[0]?.start ?? "", end: periods.at(-1)?.end ?? "", asOf: built.asOf, avgGestation: built.avgGestation });
  }, [appliedQuery]);

  // 산출 기준일: 종료일과 기간수·단위로 시작일을 자동 계산한다.
  const draftStart = draftQuery.endDate ? dailyPeriods(draftQuery.endDate, Number(draftQuery.periodCount), Number(draftQuery.unitCount), draftQuery.unit, 30)[0]?.start ?? "" : "";
  function update<K extends keyof Query>(key: K, value: Query[K]) { setDraftQuery((query) => ({ ...query, [key]: value })); }
  function applyQuery() { if (!draftQuery.endDate) { setMessage("기간선택 종료일을 선택하세요."); return; } setAppliedQuery(draftQuery); setMessage(""); }

  async function downloadExcel() {
    if (!result) return;
    setExporting(true); setMessage("");
    try {
      const fileName = `비생산일수_${result.start}_${result.end}`;
      const headers = [{ label: "구분" }, { label: "항목" }, ...result.periods.map((period) => ({ label: periodHeader(period, appliedQuery.unit, appliedQuery.unitCount) })), { label: "합계" }, { label: "평균" }, { label: "비율(%)" }];
      const response = await fetch("/api/reports/table-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: TITLE, sheetName: "비생산일수", fileName, infoLines: [`농장명: 참든팜    품종: ${appliedQuery.breed || "전체"}    조회기간: ${result.start} ~ ${result.end}`], headers, rows: result.rows.map(rowCells), totalRows: [], leftColumns: 2, mergeGroups: true }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${fileName}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const show = (value: Cell) => value === null || value === undefined ? "" : typeof value === "number" ? value.toLocaleString("ko-KR") : value;
  const head = { textAlign: "center" as const, padding: "0 8px", height: 32, fontSize: 12, whiteSpace: "nowrap" as const, borderRight: "1px solid #e3ebe7" };
  const num = { textAlign: "right" as const, padding: "0 8px", height: 30, fontSize: 12, whiteSpace: "nowrap" as const, borderRight: "1px solid #f0f4f2" };
  const label = { ...num, textAlign: "center" as const, fontWeight: 700 };
  const groupSpan = (rows: NpdRow[], index: number) => { if (index > 0 && rows[index - 1].group === rows[index].group) return 0; let span = 1; while (rows[index + span]?.group === rows[index].group) span += 1; return span; };
  const avgRow = result?.rows.find((row) => row.key === "avgNpd");

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 교배</p><h1>비생산일수 분석</h1><span>모돈이 임신·포유 중이 아닌 날(비생산일)을 구간별·원인별로 나눠 봅니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>비생산일수(기간별)</h2><p>후보돈 전입~초교배, 이유~교배, 교배~사고, 사고~재교배·도폐사 일수를 모아 평균 비생산일수와 모돈회전율을 계산합니다.</p></div></div><span className={styles.newBadge}>생산 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서 구분</span><select value="period" disabled><option value="period">{REPORT_LABEL}</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>품종</span><select value={draftQuery.breed} onChange={(event) => update("breed", event.target.value)}><option value="">- 전체 -</option>{breeds.map((breed) => <option key={breed} value={breed}>{breed}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>기간수</span><select value={draftQuery.periodCount} onChange={(event) => update("periodCount", event.target.value)}>{Array.from({ length: 52 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>단위</span><div style={{ display: "flex", gap: 8 }}><select value={draftQuery.unitCount} onChange={(event) => update("unitCount", event.target.value)}>{Array.from({ length: 30 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value.padStart(2, "0")}</option>)}</select><select value={draftQuery.unit} onChange={(event) => update("unit", event.target.value as PeriodUnit)}>{Object.entries(unitLabels).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></div></label>
        <label className={styles.field}><span className={styles.fieldLabel}>기간선택 (시작 · 자동)</span><input type="date" value={draftStart} readOnly disabled aria-label="기간 시작일(기간수·단위로 자동 계산)" /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>기간선택 (종료)</span><input type="date" value={draftQuery.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
        <div /><div /><div />
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting || !result} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6c7c76" }}>기간은 종료일을 마지막으로 {draftQuery.periodCount}개 구간 × {draftQuery.unitCount}{unitLabels[draftQuery.unit]}만큼 자동으로 맞춰집니다{draftStart ? ` (${draftStart} ~ ${draftQuery.endDate})` : ""}.</p>
      {message ? <p className={styles.exportError}>{message}</p> : null}</div>
    </section>

    {result ? <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>{TITLE}</h1><p>품종 {appliedQuery.breed || "전체"} · 조회기간 {result.start} ~ {result.end}</p></div>
      <div className={styles.listHead}><div><h2>{TITLE}</h2><p>품종 {appliedQuery.breed || "전체"} · 조회기간 {result.start} ~ {result.end} · {result.periods.length}개 구간</p></div><strong>평균 비생산일수 {show(avgRow?.average ?? null) || "-"}일</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable} style={{ minWidth: 0 }}><thead><tr>
        <th colSpan={2} style={head}>구분</th>{result.periods.map((period) => <th key={period.start} style={head}>{periodHeader(period, appliedQuery.unit, appliedQuery.unitCount)}</th>)}<th style={head}>합계</th><th style={head}>평균</th><th style={head}>비율(%)</th>
      </tr></thead><tbody>{result.rows.map((row, index) => {
        const span = groupSpan(result.rows, index); const single = span === 1 && row.group === row.label;
        const strong = ["incident-subtotal", "incident-total", "npd-total"].includes(row.key) || row.key.startsWith("avg") || row.key.startsWith("turnover");
        return <tr key={row.key} style={strong ? { background: "#f6faf8" } : undefined}>
          {span ? <td rowSpan={single ? 1 : span} colSpan={single ? 2 : 1} style={{ ...label, background: "#eef4f1" }}>{row.group}</td> : null}
          {single ? null : <td style={label}>{row.label}</td>}
          {row.values.map((value, valueIndex) => <td key={valueIndex} style={num}>{show(value)}</td>)}
          <td style={{ ...num, fontWeight: 800 }}>{show(row.total)}</td><td style={{ ...num, fontWeight: 800 }}>{show(row.average)}</td><td style={num}>{show(row.ratio)}</td>
        </tr>;
      })}</tbody></table></div>
      <p className={styles.printHidden} style={{ margin: "10px 18px 16px", fontSize: 12, color: "#6c7c76", lineHeight: 1.6 }}>
        피그플랜 매뉴얼 계산식을 따릅니다. 일수는 시작일 0·끝일 1로 세어 기간에 걸친 만큼 나눠 넣고, 아직 끝나지 않은 상태(초교배 전 후보돈, 이유 후·사고 후 미교배, 포유 중)는 {result.asOf}까지 셉니다(진행 중인 후보돈은 초교배, 이유·사고 후는 교배 행). 임신사고일수는 교배일→사고일 구간을 원인(유산·도태·폐사)이나 일수(조기재발 0~17 … 분만사불임 107일~)로 나눕니다. 상시모돈수 = (총사육일수 − 후보돈사육일수) ÷ 기간일수, 평균 비생산일수 = 총비생산일수(후보제외) × 365 ÷ 모돈사육일수, 후보돈포함 = (총비생산일수 + 후보돈사육일수) × 365 ÷ 총사육일수, 모돈회전율 = 임신일수 ÷ 모돈사육일수 × 365 ÷ 평균임신기간(임신일수 = 사육일수 − 후보돈 − 포유 − 비생산, 평균임신기간은 그 기간 분만모돈 실측{result.avgGestation ? `, 전체 ${result.avgGestation}일` : ""}; 분만이 없는 기간은 빈칸). 비율은 임신사고일수 행은 사고일수 합계 대비, 나머지는 후보돈포함 총비생산일수 대비이고, 평균 칸은 합계 ÷ 기간수(평균·회전율 행은 전체 기간 계산)입니다.
      </p>
    </section> : null}
  </ReportShell>;
}
