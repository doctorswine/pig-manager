"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { readStoredIntakeRecords, SOW_BREED_OPTIONS } from "../../production/sows/_data/intake-records";
import { readStoredMatingRecords } from "../../production/sows/_data/mating-records";
import { readStoredWeaningRecords } from "../../production/sows/_data/weaning-records";
import styles from "../../production/sows/intake/page.module.css";
import { dailyPeriods, MatingPeriod, PeriodUnit } from "../_data/mating-results";
import { buildReturnToEstrus, RETURN_BINS } from "../_data/return-to-estrus";
import GroupedBarChart from "./grouped-bar-chart";
import ReportShell from "./report-shell";

type Query = { breed: string; periodCount: string; unitCount: string; unit: PeriodUnit; endDate: string };
type Cell = string | number | null;
type Result = ReturnType<typeof buildReturnToEstrus> & { periods: MatingPeriod[]; start: string; end: string };

const TITLE = "평균발정재귀일령분석";
const unitLabels: Record<PeriodUnit, string> = { day: "일", week: "주", month: "월", year: "년" };
const INITIAL_QUERY: Query = { breed: "", periodCount: "12", unitCount: "1", unit: "month", endDate: "" };

function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
const periodHeader = (period: MatingPeriod) => period.start.slice(2); // 피그플랜처럼 구간 시작일(yy-mm-dd)

export default function ReturnToEstrusReportPage() {
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [result, setResult] = useState<Result | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  // 날짜 기본값은 화면이 열린 뒤 오늘로 채운다.
  useEffect(() => { const today = localToday(); setDraftQuery((query) => ({ ...query, endDate: today })); setAppliedQuery((query) => ({ ...query, endDate: today })); }, []);

  useEffect(() => {
    const q = appliedQuery; if (!q.endDate) return;
    const periods = dailyPeriods(q.endDate, Number(q.periodCount), Number(q.unitCount), q.unit, 30);
    const built = buildReturnToEstrus(periods, q.breed, { intakes: readStoredIntakeRecords(), matings: readStoredMatingRecords(), weanings: readStoredWeaningRecords() });
    setResult({ ...built, periods, start: periods[0]?.start ?? "", end: periods.at(-1)?.end ?? "" });
  }, [appliedQuery]);

  // 기간선택: 종료일과 기간수·단위로 시작일을 자동 계산한다.
  const draftStart = draftQuery.endDate ? dailyPeriods(draftQuery.endDate, Number(draftQuery.periodCount), Number(draftQuery.unitCount), draftQuery.unit, 30)[0]?.start ?? "" : "";
  function update<K extends keyof Query>(key: K, value: Query[K]) { setDraftQuery((query) => ({ ...query, [key]: value })); }
  function applyQuery() { if (!draftQuery.endDate) { setMessage("기간선택 종료일을 선택하세요."); return; } setAppliedQuery(draftQuery); setMessage(""); }
  const breedText = appliedQuery.breed || "전체";

  const periodRow = (data: Result): Cell[] => ["평균재귀발정일령", ...data.periodValues, data.overall];
  const parityCells = (data: Result): Cell[][] => [...data.parityRows, data.totalRow].map((row) => [row.label, ...row.counts.map((value) => value || null), row.total || null, row.average]);

  async function downloadExcel() {
    if (!result) return;
    setExporting(true); setMessage("");
    try {
      const fileName = `${TITLE}_${result.start}_${result.end}`;
      const info = [`농장명: 참든팜    품종: ${breedText}    산출기간: ${result.start} ~ ${result.end}`];
      const sheets = [
        { title: "기간별 평균발정 재귀일령", sheetName: "기간별", infoLines: info, headers: [{ label: "구분" }, ...result.periods.map((period) => ({ label: periodHeader(period) })), { label: "평균" }], rows: [periodRow(result)], totalRows: [], leftColumns: 1 },
        { title: "일령별, 산차별 교배복수 및 평균발정 재귀일령", sheetName: "일령별·산차별", infoLines: info, headers: [{ label: "산차" }, ...RETURN_BINS.map((bin) => ({ label: bin.label })), { label: "교배복수합계" }, { label: "평균발정재귀일령" }], rows: parityCells(result).slice(0, -1), totalRows: parityCells(result).slice(-1), leftColumns: 1 },
      ];
      const response = await fetch("/api/reports/table-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName, sheets }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${fileName}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const show = (value: Cell) => value === null || value === undefined ? "" : typeof value === "number" ? value.toLocaleString("ko-KR") : value;
  const head = { textAlign: "center" as const, padding: "0 8px", height: 32, fontSize: 12, whiteSpace: "nowrap" as const, borderRight: "1px solid #e3ebe7" };
  const num = { textAlign: "right" as const, padding: "0 8px", height: 30, fontSize: 12, whiteSpace: "nowrap" as const, borderRight: "1px solid #f0f4f2" };
  const label = { ...num, textAlign: "center" as const, fontWeight: 700, background: "#eef4f1" };
  const sectionTitle = { margin: "14px 18px 8px", fontSize: 14 };

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 교배</p><h1>재귀발정분석</h1><span>이유 후 첫 교배까지 걸린 일수(발정 재귀일령)를 기간별·일령별·산차별로 봅니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>{TITLE}</h2><p>기간별 평균발정 재귀일령, 발정 재귀일령별·산차별 교배복수, 산차별 평균발정 재귀일령을 표와 그래프로 제공합니다.</p></div></div><span className={styles.newBadge}>생산 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서 구분</span><select value="average" disabled><option value="average">{TITLE}</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>품종</span><select value={draftQuery.breed} onChange={(event) => update("breed", event.target.value)}><option value="">- 전체 -</option>{SOW_BREED_OPTIONS.map((breed) => <option key={breed} value={breed}>{breed}</option>)}</select></label>
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
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>{TITLE}</h1><p>품종 {breedText} · 산출기간 {result.start} ~ {result.end}</p></div>
      <div className={styles.listHead}><div><h2>{TITLE}</h2><p>품종 {breedText} · 산출기간 {result.start} ~ {result.end} · 재귀일 계산 교배 {result.count}복</p></div><strong>평균 {result.overall ?? "-"}일</strong></div>

      <h3 style={sectionTitle}>▶ 기간별 평균발정 재귀일령</h3>
      <div className={styles.tableWrap}><table className={styles.reportTable} style={{ minWidth: 0 }}><thead><tr><th style={head}>구분</th>{result.periods.map((period) => <th key={period.start} style={head}>{periodHeader(period)}</th>)}<th style={head}>평균</th></tr></thead>
        <tbody><tr>{periodRow(result).map((value, index) => <td key={index} style={index === 0 ? label : index === result.periods.length + 1 ? { ...num, fontWeight: 800 } : num}>{show(value)}</td>)}</tr>
          <tr>{["교배복수", ...result.periodCounts.map((value) => value || null), result.count || null].map((value, index) => <td key={index} style={index === 0 ? { ...label, fontWeight: 600, color: "#52635d" } : { ...num, color: "#6c7c76" }}>{show(value)}</td>)}</tr></tbody></table></div>
      <div style={{ padding: "16px 18px 4px" }}><GroupedBarChart ariaLabel="기간별 평균발정 재귀일령" unit="일" showValues emptyText="산출기간 안에 재귀일을 계산할 교배가 없습니다." categories={result.periods.map(periodHeader)} series={[{ name: "평균재귀발정일령", values: result.periodValues }]} /></div>

      <h3 style={sectionTitle}>▶ 일령별, 산차별 교배복수 및 평균발정 재귀일령</h3>
      <div className={styles.tableWrap}><table className={styles.reportTable} style={{ minWidth: 0 }}><thead><tr><th style={head}>산차</th>{RETURN_BINS.map((bin) => <th key={bin.label} style={head}>{bin.label}</th>)}<th style={head}>교배복수합계</th><th style={head}>평균발정재귀일령</th></tr></thead>
        <tbody>{parityCells(result).map((row, rowIndex, rows) => { const total = rowIndex === rows.length - 1; return <tr key={String(row[0])} style={total ? { background: "#eef4f1" } : undefined}>{row.map((value, index) => <td key={index} style={index === 0 ? label : total || index >= RETURN_BINS.length + 1 ? { ...num, fontWeight: 800 } : num}>{show(value)}</td>)}</tr>; })}</tbody></table></div>

      <p className={styles.printHidden} style={{ margin: "12px 18px 16px", fontSize: 12, color: "#6c7c76", lineHeight: 1.6 }}>
        피그플랜 정의를 따릅니다. 재귀일(발정 재귀일령) = 교배일 − 이전 이유일이며, 산출기간 안에 교배한 경산돈(산차 1 이상)의 이유 후 첫 교배만 셉니다(같은 산차의 재발 재교배는 제외). 산차는 교배 기록의 산차(산차 0 후보돈은 이유 기록이 없어 0으로 표시)입니다. 기간별 평균 칸과 합계 행은 전체 교배의 평균입니다(피그플랜 엑셀의 평균 칸은 월별 평균을 단순 평균함).
      </p>
    </section> : null}
  </ReportShell>;
}
