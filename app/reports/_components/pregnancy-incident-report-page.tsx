"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { readStoredCullRecords } from "../../production/sows/_data/cull-records";
import { readStoredFarrowingRecords } from "../../production/sows/_data/farrowing-records";
import { readStoredMatingRecords } from "../../production/sows/_data/mating-records";
import { readStoredPregnancyIncidentRecords } from "../../production/sows/_data/pregnancy-incident-records";
import styles from "../../production/sows/intake/page.module.css";
import { dailyPeriods, MatingPeriod, PeriodUnit } from "../_data/mating-results";
import { buildIncidentAnalysis, collectIncidentEvents, IncidentRow } from "../_data/pregnancy-incident-analysis";
import ReportShell from "./report-shell";

type Query = { periodCount: string; unitCount: string; unit: PeriodUnit; endDate: string };
type Cell = string | number | null;

const TITLE = "임신사고원인분석";
const unitLabels: Record<PeriodUnit, string> = { day: "일", week: "주", month: "월", year: "년" };
const INITIAL_QUERY: Query = { periodCount: "12", unitCount: "1", unit: "month", endDate: "" };

function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
const periodHeader = (period: MatingPeriod) => period.start.slice(2); // 피그플랜처럼 구간 시작일(yy-mm-dd)
const rowCells = (row: IncidentRow): Cell[] => [row.group, row.label, ...row.values, row.total, row.average];

export default function PregnancyIncidentReportPage() {
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [result, setResult] = useState<{ periods: MatingPeriod[]; rows: IncidentRow[]; start: string; end: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  // 날짜 기본값은 화면이 열린 뒤 오늘로 채운다.
  useEffect(() => { const today = localToday(); setDraftQuery((query) => ({ ...query, endDate: today })); setAppliedQuery((query) => ({ ...query, endDate: today })); }, []);

  useEffect(() => {
    const q = appliedQuery; if (!q.endDate) return;
    const periods = dailyPeriods(q.endDate, Number(q.periodCount), Number(q.unitCount), q.unit, 30);
    const events = collectIncidentEvents(readStoredMatingRecords(), readStoredPregnancyIncidentRecords(), readStoredCullRecords(), readStoredFarrowingRecords());
    const built = buildIncidentAnalysis(periods, events);
    setResult({ periods, rows: built.rows, start: periods[0]?.start ?? "", end: periods.at(-1)?.end ?? "" });
  }, [appliedQuery]);

  // 산출 기준일: 종료일과 기간수·단위로 시작일을 자동 계산한다.
  const draftStart = draftQuery.endDate ? dailyPeriods(draftQuery.endDate, Number(draftQuery.periodCount), Number(draftQuery.unitCount), draftQuery.unit, 30)[0]?.start ?? "" : "";
  function update<K extends keyof Query>(key: K, value: Query[K]) { setDraftQuery((query) => ({ ...query, [key]: value })); }
  function applyQuery() { if (!draftQuery.endDate) { setMessage("산출 기준일(종료일)을 선택하세요."); return; } setAppliedQuery(draftQuery); setMessage(""); }

  async function downloadExcel() {
    if (!result) return;
    setExporting(true); setMessage("");
    try {
      const fileName = `${TITLE}_${result.start}_${result.end}`;
      const headers = [{ label: "구분" }, { label: "항목" }, ...result.periods.map((period) => ({ label: periodHeader(period) })), { label: "합계" }, { label: "평균" }];
      const response = await fetch("/api/reports/table-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: TITLE, sheetName: TITLE, fileName, infoLines: [`농장명: 참든팜    산출기간: ${result.start} ~ ${result.end}`], headers, rows: result.rows.map(rowCells), totalRows: [], leftColumns: 2, mergeGroups: true }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${fileName}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const show = (value: Cell) => value === null || value === undefined ? "" : typeof value === "number" ? value.toLocaleString("ko-KR") : value;
  const head = { textAlign: "center" as const, padding: "0 8px", height: 32, fontSize: 12, whiteSpace: "nowrap" as const, borderRight: "1px solid #e3ebe7" };
  const num = { textAlign: "right" as const, padding: "0 8px", height: 30, fontSize: 12, whiteSpace: "nowrap" as const, borderRight: "1px solid #f0f4f2" };
  const label = { ...num, textAlign: "center" as const, fontWeight: 700 };
  const groupSpan = (rows: IncidentRow[], index: number) => { if (index > 0 && rows[index - 1].group === rows[index].group) return 0; let span = 1; while (rows[index + span]?.group === rows[index].group) span += 1; return span; };
  const totalRow = result?.rows.find((row) => row.key === "total");

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 교배</p><h1>임신사고 원인분석</h1><span>산출 기간 안에 발생한 임신사고를 구간별·원인별로 나눠 봅니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>임신사고원인분석</h2><p>구분별(원인), 일수별(교배 후 사고까지 일수), 산차별, 교배차수별(연속 사고)로 사고 두수를 셉니다.</p></div></div><span className={styles.newBadge}>생산 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서 구분</span><select value="analysis" disabled><option value="analysis">임신사고원인분석</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>기간수</span><select value={draftQuery.periodCount} onChange={(event) => update("periodCount", event.target.value)}>{Array.from({ length: 52 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>단위</span><div style={{ display: "flex", gap: 8 }}><select value={draftQuery.unitCount} onChange={(event) => update("unitCount", event.target.value)}>{Array.from({ length: 30 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value.padStart(2, "0")}</option>)}</select><select value={draftQuery.unit} onChange={(event) => update("unit", event.target.value as PeriodUnit)}>{Object.entries(unitLabels).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></div></label>
        <label className={styles.field}><span className={styles.fieldLabel}>산출 기준일 (시작 · 자동)</span><input type="date" value={draftStart} readOnly disabled aria-label="산출 시작일(기간수·단위로 자동 계산)" /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>산출 기준일 (종료)</span><input type="date" value={draftQuery.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
        <div /><div /><div /><div />
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting || !result} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6c7c76" }}>산출 기준일은 종료일을 마지막으로 {draftQuery.periodCount}개 구간 × {draftQuery.unitCount}{unitLabels[draftQuery.unit]}만큼 자동으로 맞춰집니다{draftStart ? ` (${draftStart} ~ ${draftQuery.endDate})` : ""}.</p>
      {message ? <p className={styles.exportError}>{message}</p> : null}</div>
    </section>

    {result ? <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>{TITLE}</h1><p>산출기간 {result.start} ~ {result.end}</p></div>
      <div className={styles.listHead}><div><h2>{TITLE}</h2><p>산출기간 {result.start} ~ {result.end} · {result.periods.length}개 구간</p></div><strong>총 사고 {show(totalRow?.total ?? 0)}두</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable} style={{ minWidth: 0 }}><thead><tr>
        <th colSpan={2} style={head}>구분</th>{result.periods.map((period) => <th key={period.start} style={head}>{periodHeader(period)}</th>)}<th style={head}>합계</th><th style={head}>평균</th>
      </tr></thead><tbody>{result.rows.map((row, index) => {
        const span = groupSpan(result.rows, index); const single = span === 1 && row.group === row.label;
        const strong = row.key === "total" || row.kind !== "count";
        return <tr key={row.key} style={strong ? { background: "#f6faf8" } : undefined}>
          {span ? <td rowSpan={single ? 1 : span} colSpan={single ? 2 : 1} style={{ ...label, background: "#eef4f1" }}>{row.group}</td> : null}
          {single ? null : <td style={label}>{row.label}</td>}
          {row.values.map((value, valueIndex) => <td key={valueIndex} style={num}>{show(value)}</td>)}
          <td style={{ ...num, fontWeight: 800 }}>{show(row.total)}</td><td style={{ ...num, fontWeight: 800 }}>{show(row.average)}</td>
        </tr>;
      })}</tbody></table></div>
      <p className={styles.printHidden} style={{ margin: "10px 18px 16px", fontSize: 12, color: "#6c7c76", lineHeight: 1.6 }}>
        사고는 임신사고 기록과, 사고 기록 없이 교배 후 분만 전(121일 이내)에 도태·폐사된 모돈을 함께 셉니다. 일수별은 교배일→사고일 일수로 조기재발 17일 이하, 1차재발 18~24일, 불규칙재발 25~37일, 2차재발 38~44일, 지연재발 45일 이상(원인이 공태면 공태), 분만사불임은 분만예정일(교배 115일째) 이후 확인된 사고입니다. 산차별은 교배 당시 산차, 교배차수별은 마지막 분만 이후 연속으로 사고 난 횟수입니다. 평균 칸은 합계 ÷ 기간수이며, 평균사고일수의 합계·평균은 총사고일수 ÷ 총사고두수입니다.
      </p>
    </section> : null}
  </ReportShell>;
}
