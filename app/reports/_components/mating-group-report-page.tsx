"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { readStoredCullRecords } from "../../production/sows/_data/cull-records";
import { readStoredFarrowingRecords } from "../../production/sows/_data/farrowing-records";
import { readStoredMatingRecords } from "../../production/sows/_data/mating-records";
import { readStoredPregnancyIncidentRecords } from "../../production/sows/_data/pregnancy-incident-records";
import { readStoredWeaningRecords } from "../../production/sows/_data/weaning-records";
import styles from "../../production/sows/intake/page.module.css";
import { buildMatingGroups, GroupRow, INCIDENT_WEEKS, WeeklyRow } from "../_data/mating-group";
import { dailyPeriods, PeriodUnit } from "../_data/mating-results";
import ReportShell from "./report-shell";

type ReportType = "group" | "weekly";
type Query = { reportType: ReportType; periodCount: string; unitCount: string; unit: PeriodUnit; baseDate: string };
type Cell = string | number | null;
type Header = { label: string; children?: string[] };

const reportTypeLabels: Record<ReportType, string> = { group: "교배그룹별 생산성적(그룹별)", weekly: "교배그룹별 생산성적(주차별)" };
const unitLabels: Record<PeriodUnit, string> = { day: "일", week: "주", month: "월", year: "년" };
const INITIAL_QUERY: Query = { reportType: "group", periodCount: "12", unitCount: "1", unit: "week", baseDate: "" };

function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
const blankZero = (value: number | null) => (value === null || value === 0 ? null : value);

// 그룹별 표: 피그플랜 엑셀 양식의 열 순서
const GROUP_HEADERS: Header[] = [
  { label: "교배일" }, { label: "교배그룹" }, { label: "교배복수" }, { label: "임신사고", children: ["재발", "유산", "도태", "폐사"] }, { label: "임돈전출판매" }, { label: "평균 사고일수" },
  { label: "분만기간" }, { label: "분만복수" }, { label: "산차" }, { label: "분만율(%)" }, { label: "임신기간" }, { label: "총산" }, { label: "평균 총산" }, { label: "미라" }, { label: "사산" }, { label: "실산" }, { label: "평균 실산" },
  { label: "이유모돈" }, { label: "대리이유" }, { label: "이유두수" }, { label: "복당이유" }, { label: "정상이유일령" }, { label: "재귀복수" }, { label: "재귀일" },
];
function groupCells(row: GroupRow): Cell[] {
  return [row.label, row.group, row.matings, blankZero(row.incidents.재발), blankZero(row.incidents.유산), blankZero(row.incidents.도태), blankZero(row.incidents.폐사), blankZero(row.removed), row.incidentDays,
    row.farrowingRange, row.farrowings, row.parity, row.farrowingRate, row.gestation, blankZero(row.totalBorn), row.avgTotalBorn, blankZero(row.mummified), blankZero(row.stillborn), blankZero(row.liveBorn), row.avgLiveBorn,
    row.weanedSows, blankZero(row.fosterWeaned), row.weaned, row.weanedPerLitter, row.weaningAge, row.rematedSows, row.returnDays];
}
const WEEKLY_HEADERS: Header[] = [{ label: "주차" }, { label: "교배복수" }, { label: "교배 후 사고 발생 주차", children: Array.from({ length: INCIDENT_WEEKS }, (_, index) => String(index + 1)) }, { label: "미분만복수" }, { label: "분만복수" }, { label: "분만율(%)" }, { label: "지연분만" }, { label: "전출복수" }];
function weeklyCells(row: WeeklyRow): Cell[] { return [row.label, row.matings, ...row.byWeek.map(blankZero), blankZero(row.pending), blankZero(row.farrowings), row.farrowingRate, blankZero(row.overdue), blankZero(row.removed)]; }

export default function MatingGroupReportPage() {
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [result, setResult] = useState<{ headers: Header[]; rows: Cell[][]; totals: Cell[][]; start: string; end: string; leftColumns: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  // 날짜 기본값은 화면이 열린 뒤 오늘로 채운다.
  useEffect(() => { const today = localToday(); setDraftQuery((query) => ({ ...query, baseDate: today })); setAppliedQuery((query) => ({ ...query, baseDate: today })); }, []);

  useEffect(() => {
    const q = appliedQuery; if (!q.baseDate) return;
    const periods = dailyPeriods(q.baseDate, Number(q.periodCount), Number(q.unitCount), q.unit, 30);
    const built = buildMatingGroups(periods, q.unit, Number(q.unitCount), readStoredMatingRecords(), readStoredPregnancyIncidentRecords(), readStoredCullRecords(), readStoredFarrowingRecords(), readStoredWeaningRecords());
    const start = periods[0]?.start ?? ""; const end = periods.at(-1)?.end ?? "";
    if (q.reportType === "group") {
      const total = groupCells(built.groupTotal); total[0] = "합계/평균"; total[1] = "";
      setResult({ headers: GROUP_HEADERS, rows: built.groupRows.map(groupCells), totals: [total], start, end, leftColumns: 2 });
    } else setResult({ headers: WEEKLY_HEADERS, rows: built.weeklyRows.map(weeklyCells), totals: [weeklyCells(built.weeklyTotal)], start, end, leftColumns: 1 });
  }, [appliedQuery]);

  // 기간선택: 주차기준일을 마지막으로 기간수·단위만큼 시작일을 자동 계산한다.
  const draftStart = draftQuery.baseDate ? dailyPeriods(draftQuery.baseDate, Number(draftQuery.periodCount), Number(draftQuery.unitCount), draftQuery.unit, 30)[0]?.start ?? "" : "";
  function update<K extends keyof Query>(key: K, value: Query[K]) { setDraftQuery((query) => ({ ...query, [key]: value })); }
  function applyQuery() { if (!draftQuery.baseDate) { setMessage("주차기준일을 선택하세요."); return; } setAppliedQuery(draftQuery); setMessage(""); }

  async function downloadExcel() {
    if (!result) return;
    setExporting(true); setMessage("");
    try {
      const title = reportTypeLabels[appliedQuery.reportType];
      const response = await fetch("/api/reports/table-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, sheetName: appliedQuery.reportType === "group" ? "교배그룹별" : "교배주차별", fileName: `${title.replace(/[()\s]/g, "")}_${result.start}_${result.end}`, infoLines: [`농장명: 참든팜    ${appliedQuery.reportType === "weekly" ? `주차기준일: ${appliedQuery.baseDate}    ` : ""}산출기간: ${result.start} ~ ${result.end}`], headers: result.headers, rows: result.rows, totalRows: result.totals, leftColumns: result.leftColumns }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${title.replace(/[()\s]/g, "")}_${result.start}_${result.end}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const twoLevel = result?.headers.some((header) => header.children?.length) ?? false;
  const show = (value: Cell) => value === null || value === undefined ? "" : typeof value === "number" ? value.toLocaleString("ko-KR") : value;
  const head = { textAlign: "center" as const, padding: "0 8px", height: 32, fontSize: 12, whiteSpace: "nowrap" as const, borderRight: "1px solid #e3ebe7" };
  const cell = (index: number, leftColumns: number) => ({ textAlign: (index < leftColumns ? "center" : "right") as "center" | "right", padding: "0 8px", height: 30, fontSize: 12, whiteSpace: "nowrap" as const, borderRight: "1px solid #f0f4f2" });

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 교배</p><h1>교배그룹별 성적</h1><span>교배 구간(그룹)마다 그 구간에 교배한 모돈의 임신사고·분만·이유·재귀 결과를 따라가 생산성적을 봅니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>교배그룹별 생산성적</h2><p>그룹별은 구간별 생산성적, 주차별은 교배 후 몇 주차에 사고가 났는지와 분만 진행 상황을 보여줍니다.</p></div></div><span className={styles.newBadge}>생산 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서 구분</span><select value={draftQuery.reportType} onChange={(event) => update("reportType", event.target.value as ReportType)}><option value="group">교배 그룹별</option><option value="weekly">교배 주차별</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>기간수</span><select value={draftQuery.periodCount} onChange={(event) => update("periodCount", event.target.value)}>{Array.from({ length: 52 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>단위</span><div style={{ display: "flex", gap: 8 }}><select value={draftQuery.unitCount} onChange={(event) => update("unitCount", event.target.value)}>{Array.from({ length: 30 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value.padStart(2, "0")}</option>)}</select><select value={draftQuery.unit} onChange={(event) => update("unit", event.target.value as PeriodUnit)}>{Object.entries(unitLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></label>
        <label className={styles.field}><span className={styles.fieldLabel}>주차기준일</span><input type="date" value={draftQuery.baseDate} onChange={(event) => update("baseDate", event.target.value)} /></label>
        <div />
        <label className={styles.field}><span className={styles.fieldLabel}>기간선택 (시작 · 자동)</span><input type="date" value={draftStart} readOnly disabled aria-label="기간 시작일(기간수·단위로 자동 계산)" /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>기간선택 (종료 = 주차기준일)</span><input type="date" value={draftQuery.baseDate} readOnly disabled aria-label="기간 종료일(주차기준일)" /></label>
        <div /><div />
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting || !result} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6c7c76" }}>기간은 주차기준일을 마지막으로 {draftQuery.periodCount}개 구간 × {draftQuery.unitCount}{unitLabels[draftQuery.unit]}만큼 자동으로 맞춰집니다{draftStart ? ` (${draftStart} ~ ${draftQuery.baseDate})` : ""}.</p>
      {message ? <p className={styles.exportError}>{message}</p> : null}</div>
    </section>

    {result ? <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>{reportTypeLabels[appliedQuery.reportType]}</h1><p>{appliedQuery.reportType === "weekly" ? `주차기준일 ${appliedQuery.baseDate} · ` : ""}산출기간 {result.start} ~ {result.end}</p></div>
      <div className={styles.listHead}><div><h2>{reportTypeLabels[appliedQuery.reportType]}</h2><p>{appliedQuery.reportType === "weekly" ? `주차기준일 ${appliedQuery.baseDate} · ` : ""}산출기간 {result.start} ~ {result.end} · {result.rows.length}개 구간</p></div><strong>교배 {show(result.totals[0][appliedQuery.reportType === "group" ? 2 : 1])}복</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable} style={{ minWidth: 0 }}><thead>
        <tr>{result.headers.map((header) => <th key={header.label} colSpan={header.children?.length || 1} rowSpan={twoLevel && !header.children?.length ? 2 : 1} style={head}>{header.label}</th>)}</tr>
        {twoLevel ? <tr>{result.headers.flatMap((header) => (header.children ?? []).map((child) => <th key={`${header.label}-${child}`} style={{ ...head, minWidth: 34 }}>{child}</th>))}</tr> : null}
      </thead><tbody>{result.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, index) => <td key={index} style={cell(index, result.leftColumns)}>{index === 0 || (result.leftColumns === 2 && index === 1) ? <strong>{show(value)}</strong> : show(value)}</td>)}</tr>)}</tbody>
      <tfoot>{result.totals.map((row, rowIndex) => <tr key={rowIndex} style={{ background: "#eef4f1", fontWeight: 800 }}>{row.map((value, index) => <td key={index} style={{ ...cell(index, result.leftColumns), fontWeight: 800 }}>{show(value)}</td>)}</tr>)}</tfoot></table></div>
      <p className={styles.printHidden} style={{ margin: "10px 18px 16px", fontSize: 12, color: "#6c7c76", lineHeight: 1.6 }}>
        {appliedQuery.reportType === "group"
          ? "각 행은 그 구간에 교배한 모돈의 결과입니다(교배 후 다음 교배 전 첫 기록). 임신사고의 재발 칸에는 불임·공태도 포함하며, 사고 기록 없이 임신 중 도태·폐사된 모돈은 도태·폐사 칸, 전출·판매는 임돈전출판매 칸으로 셉니다. 분만율 = 분만복수 ÷ 교배복수, 임신기간 = 교배일→분만일, 대리이유 = 재포유한 이유 모돈, 정상이유일령 = 이유일령 평균, 재귀일 = 이유일→다음 교배일 평균입니다. 교배그룹 번호는 일요일 시작 주차입니다."
          : "1~17은 교배 후 몇 주차에 임신사고(또는 임신 중 도태·폐사)가 났는지의 두수입니다. 미분만복수는 아직 분만예정일(교배 115일째) 전이라 결과가 없는 두수, 지연분만은 분만예정일이 지났는데 분만·사고 기록이 없는 두수, 전출복수는 임신 중 전출·판매된 두수입니다."}
      </p>
    </section> : null}
  </ReportShell>;
}
