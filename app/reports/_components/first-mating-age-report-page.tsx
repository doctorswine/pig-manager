"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { readStoredFarrowingRecords } from "../../production/sows/_data/farrowing-records";
import { readStoredIntakeRecords, SOW_BREED_OPTIONS } from "../../production/sows/_data/intake-records";
import { readStoredMatingRecords } from "../../production/sows/_data/mating-records";
import { readStoredWeaningRecords } from "../../production/sows/_data/weaning-records";
import styles from "../../production/sows/intake/page.module.css";
import { AgeRow, buildFirstMatingAge, DISTRIBUTION_BINS, RESULT_BINS } from "../_data/first-mating-age";
import { dailyPeriods, PeriodUnit } from "../_data/mating-results";
import GroupedBarChart from "./grouped-bar-chart";
import ReportShell from "./report-shell";

type ReportType = "result" | "distribution";
type Query = { reportType: ReportType; breed: string; unitCount: string; unit: PeriodUnit; endDate: string };
type Cell = string | number | null;
type Result = { start: string; end: string; resultRows: AgeRow[]; distributionRow: AgeRow; litterCount: number; matedCount: number; avgAge: number | null; missingBirth: number };

const reportTypeLabels: Record<ReportType, string> = { result: "초교배일령별 성적", distribution: "초교배일령별 분포" };
const unitLabels: Record<PeriodUnit, string> = { day: "일", week: "주", month: "월", year: "년" };
const INITIAL_QUERY: Query = { reportType: "result", breed: "", unitCount: "12", unit: "month", endDate: "" };

function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
// 산출 기준일: 종료일에서 단위 길이(예: 12개월)만큼 거슬러 올라간 하나의 구간
const rangeOf = (query: Query) => { const period = query.endDate ? dailyPeriods(query.endDate, 1, Number(query.unitCount), query.unit, 52)[0] : undefined; return { start: period?.start ?? "", end: query.endDate }; };
const cells = (row: AgeRow): Cell[] => [row.label, ...row.values, row.total];

export default function FirstMatingAgeReportPage() {
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [result, setResult] = useState<Result | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  // 날짜 기본값은 화면이 열린 뒤 오늘로 채운다.
  useEffect(() => { const today = localToday(); setDraftQuery((query) => ({ ...query, endDate: today })); setAppliedQuery((query) => ({ ...query, endDate: today })); }, []);

  useEffect(() => {
    if (!appliedQuery.endDate) return;
    const range = rangeOf(appliedQuery);
    const built = buildFirstMatingAge(range, appliedQuery.breed, { intakes: readStoredIntakeRecords(), matings: readStoredMatingRecords(), farrowings: readStoredFarrowingRecords(), weanings: readStoredWeaningRecords() });
    setResult({ ...range, ...built });
  }, [appliedQuery]);

  const draftRange = rangeOf(draftQuery);
  function update<K extends keyof Query>(key: K, value: Query[K]) { setDraftQuery((query) => ({ ...query, [key]: value })); }
  function applyQuery() { if (!draftQuery.endDate) { setMessage("산출 기준일(종료일)을 선택하세요."); return; } setAppliedQuery(draftQuery); setMessage(""); }
  const breedText = appliedQuery.breed || "전체";
  const title = reportTypeLabels[appliedQuery.reportType];

  async function downloadExcel() {
    if (!result) return;
    setExporting(true); setMessage("");
    try {
      const fileName = `${title.replace(/\s/g, "")}_${result.start}_${result.end}`;
      const info = [`농장명: 참든팜    품종: ${breedText}    산출기간: ${result.start} ~ ${result.end}`];
      const sheets = appliedQuery.reportType === "result"
        ? [{ title, sheetName: "초교배일령별성적", infoLines: info, headers: [{ label: "구분" }, ...RESULT_BINS.map((bin) => ({ label: bin.label })), { label: "합계" }], rows: result.resultRows.map(cells), totalRows: [], leftColumns: 1 }]
        : [{ title, sheetName: "초교배일령별분포", infoLines: info, headers: [{ label: "구분" }, ...DISTRIBUTION_BINS.map((bin) => ({ label: bin.label })), { label: "합계" }], rows: [cells(result.distributionRow)], totalRows: [], leftColumns: 1 }];
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
  const table = (binLabels: string[], rows: AgeRow[]) => <div className={styles.tableWrap}><table className={styles.reportTable} style={{ minWidth: 0 }}><thead><tr>
    <th style={head}>구분</th>{binLabels.map((text) => <th key={text} style={head}>{text}</th>)}<th style={head}>합계</th>
  </tr></thead><tbody>{rows.map((row) => <tr key={row.key}><td style={label}>{row.label}</td>{row.values.map((value, index) => <td key={index} style={num}>{show(value)}</td>)}<td style={{ ...num, fontWeight: 800 }}>{show(row.total)}</td></tr>)}</tbody></table></div>;
  const rowOf = (key: string) => result?.resultRows.find((row) => row.key === key);
  const dataBins = RESULT_BINS.map((_, index) => index).filter((index) => (rowOf("farrowings")?.values[index] ?? 0) > 0);
  const chartBins = dataBins.length ? dataBins : RESULT_BINS.map((_, index) => index); // 분만이 있는 구간만 그래프에(없으면 전 구간 빈 그래프)
  const missingNote = result?.missingBirth ? <p style={{ margin: "8px 18px 0", padding: "8px 12px", background: "#fff7e6", border: "1px solid #f3dca6", borderRadius: 8, fontSize: 12, color: "#7a5a12" }}>산출기간 안에 초교배한 모돈 중 {result.missingBirth}두는 모돈 전입관리에 출생일이 없어 초교배일령을 계산하지 못해 제외했습니다. 전입관리에서 출생일을 입력하면 포함됩니다.</p> : null;

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 교배</p><h1>초교배 일령별 성적</h1><span>후보돈의 초교배 일령(출생일→첫 교배일)별로 초산 분만성적·재귀 정보와 초교배 일령 분포를 봅니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>초교배일령별 성적</h2><p>보고서 구분에서 초교배일령별 성적(분만성적·재귀정보) 또는 초교배일령별 분포를 골라 표와 그래프로 봅니다.</p></div></div><span className={styles.newBadge}>생산 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서 구분</span><select value={draftQuery.reportType} onChange={(event) => update("reportType", event.target.value as ReportType)}><option value="result">초교배일령별 성적</option><option value="distribution">초교배일령별 분포</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>품종</span><select value={draftQuery.breed} onChange={(event) => update("breed", event.target.value)}><option value="">- 전체 -</option>{SOW_BREED_OPTIONS.map((breed) => <option key={breed} value={breed}>{breed}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>단위</span><div style={{ display: "flex", gap: 8 }}><select value={draftQuery.unitCount} onChange={(event) => update("unitCount", event.target.value)}>{Array.from({ length: 52 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={draftQuery.unit} onChange={(event) => update("unit", event.target.value as PeriodUnit)}>{Object.entries(unitLabels).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></div></label>
        <label className={styles.field}><span className={styles.fieldLabel}>산출 기준일 (시작 · 자동)</span><input type="date" value={draftRange.start} readOnly disabled aria-label="산출 시작일(단위로 자동 계산)" /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>산출 기준일 (종료)</span><input type="date" value={draftQuery.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
        <div /><div /><div /><div />
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting || !result} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6c7c76" }}>산출 기준일은 종료일을 마지막으로 {draftQuery.unitCount}{unitLabels[draftQuery.unit]}만큼 자동으로 맞춰집니다{draftRange.start ? ` (${draftRange.start} ~ ${draftQuery.endDate})` : ""}.</p>
      {message ? <p className={styles.exportError}>{message}</p> : null}</div>
    </section>

    {result && appliedQuery.reportType === "result" ? <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>{title}</h1><p>품종 {breedText} · 산출기간 {result.start} ~ {result.end}</p></div>
      <div className={styles.listHead}><div><h2>{title}</h2><p>품종 {breedText} · 산출기간 {result.start} ~ {result.end} 에 분만한 초산</p></div><strong>분만 {result.litterCount}복</strong></div>
      {table(RESULT_BINS.map((bin) => bin.label), result.resultRows)}
      {missingNote}
      <div style={{ padding: "16px 18px 4px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>초교배일령별 평균 총산 · 평균 실산 · 평균 재귀일</h3>
        <GroupedBarChart ariaLabel="초교배일령별 평균 총산, 평균 실산, 평균 재귀일" unit="두·일" showValues emptyText="산출기간 안에 분만한 초산이 없습니다." categories={chartBins.map((index) => RESULT_BINS[index].label)} series={[
          { name: "평균 총산", unit: "두", values: chartBins.map((index) => rowOf("avgTotal")?.values[index] ?? null) },
          { name: "평균 실산", unit: "두", values: chartBins.map((index) => rowOf("avgLive")?.values[index] ?? null) },
          { name: "평균 재귀일", unit: "일", values: chartBins.map((index) => rowOf("avgReturn")?.values[index] ?? null) },
        ]} />
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6c7c76" }}>피그플랜처럼 분만이 있는 일령 구간만 그래프에 표시합니다(자료가 없으면 전 구간을 빈 그래프로 표시). 평균 총산·실산은 두, 평균 재귀일은 일입니다.</p>
      </div>
      <p className={styles.printHidden} style={{ margin: "10px 18px 16px", fontSize: 12, color: "#6c7c76", lineHeight: 1.6 }}>
        초교배일령 = 첫 교배일(산차 0 교배 중 가장 이른 날) − 출생일(모돈 전입관리의 출생일)입니다. 성적은 산출기간 안에 분만한 초산(초교배 이후 첫 분만)을 그 모돈의 초교배일령 구간으로 묶습니다. 평균 실산 = 생존 암·수 합, 재귀 = 그 분만의 이유일 → 다음 교배일, 평균 이유두수 = 그 분만의 이유두수 평균입니다. 합계 칸의 평균 행은 전체 초산의 평균입니다(피그플랜 엑셀은 구간 평균을 단순 합산).
      </p>
    </section> : null}
    {result && appliedQuery.reportType === "distribution" ? <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>{title}</h1><p>품종 {breedText} · 조회기간 {result.start} ~ {result.end}</p></div>
      <div className={styles.listHead}><div><h2>{title}</h2><p>품종 {breedText} · 조회기간 {result.start} ~ {result.end} 에 초교배한 후보돈{result.avgAge ? ` · 평균 초교배일령 ${result.avgAge}일` : ""}</p></div><strong>초교배 {result.matedCount}두</strong></div>
      {table(DISTRIBUTION_BINS.map((bin) => bin.label), [result.distributionRow])}
      {missingNote}
      <div style={{ padding: "16px 18px 18px" }}><h3 style={{ margin: "0 0 8px", fontSize: 14 }}>초교배일령별 돼지두수</h3><GroupedBarChart ariaLabel="초교배일령별 두수 분포" unit="두" showValues categories={DISTRIBUTION_BINS.map((bin) => bin.label)} emptyText="산출기간 안에 초교배한 후보돈이 없습니다." series={[{ name: "돼지두수", values: result.distributionRow.values }]} /></div>
    </section> : null}
  </ReportShell>;
}
