"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readStoredBackfatRecords, SowBackfatRecord } from "../../production/sows/_data/backfat-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

type SortKey = "measurementDate" | "animalNo" | "earTag" | "parity" | "breed";
type SortDirection = "asc" | "desc";
type Query = { fromDate: string; toDate: string; primarySortKey: SortKey; primarySortDirection: SortDirection; secondarySortKey: SortKey; secondarySortDirection: SortDirection };
const TODAY = new Date().toISOString().slice(0, 10);
const THIRTY_DAYS_AGO = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
const INITIAL_QUERY: Query = { fromDate: THIRTY_DAYS_AGO, toDate: TODAY, primarySortKey: "measurementDate", primarySortDirection: "desc", secondarySortKey: "animalNo", secondarySortDirection: "asc" };
const sortLabels: Record<SortKey, string> = { measurementDate: "측정일", animalNo: "모돈번호", earTag: "이각번호", parity: "산차", breed: "품종" };

function compareRows(left: SowBackfatRecord, right: SowBackfatRecord, sortKey: SortKey) {
  if (sortKey === "parity") return Number(left.parity || 0) - Number(right.parity || 0);
  return String(left[sortKey] ?? "").localeCompare(String(right[sortKey] ?? ""), "ko", { numeric: true });
}
function compareByQuery(left: SowBackfatRecord, right: SowBackfatRecord, query: Query) {
  const primary = compareRows(left, right, query.primarySortKey) * (query.primarySortDirection === "asc" ? 1 : -1);
  return primary || compareRows(left, right, query.secondarySortKey) * (query.secondarySortDirection === "asc" ? 1 : -1);
}

export default function BackfatLedgerPage() {
  const [rows, setRows] = useState<SowBackfatRecord[]>([]);
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  useEffect(() => { setRows(readStoredBackfatRecords()); }, []);
  const filteredRows = useMemo(() => rows.filter((row) => (!appliedQuery.fromDate || row.measurementDate >= appliedQuery.fromDate) && (!appliedQuery.toDate || row.measurementDate <= appliedQuery.toDate)).sort((left, right) => compareByQuery(left, right, appliedQuery)), [appliedQuery, rows]);

  function applyQuery() { setAppliedQuery(draftQuery); setExportError(""); }
  async function downloadExcel() {
    setExporting(true); setExportError("");
    try {
      const response = await fetch("/api/reports/backfat/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: filteredRows, query: appliedQuery, farmName: "참든팜" }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `등지방대장_${appliedQuery.fromDate || "전체"}_${appliedQuery.toDate || "전체"}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setExportError(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const sortOptions = Object.entries(sortLabels);
  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 작업대장 / 등지방 대장</p><h1>등지방 대장</h1><span>저장된 체중·등지방 측정 기록을 기간별로 조회하고 두 단계 기준으로 정렬합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>등지방 대장 조회</h2><p>측정일과 1·2차 정렬기준을 선택하세요.</p></div></div><span className={styles.newBadge}>등지방 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서 구분</span><select value="backfat" disabled><option value="backfat">등지방 대장</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>측정일 시작</span><input type="date" value={draftQuery.fromDate} onChange={(event) => setDraftQuery((query) => ({ ...query, fromDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>측정일 종료</span><input type="date" value={draftQuery.toDate} onChange={(event) => setDraftQuery((query) => ({ ...query, toDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬기준</span><select value={draftQuery.primarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬방향</span><select value={draftQuery.primarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬기준</span><select value={draftQuery.secondarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬방향</span><select value={draftQuery.secondarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{exportError ? <p className={styles.exportError}>{exportError}</p> : null}</div>
    </section>
    <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>등지방 대장</h1><p>측정일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"} · 정렬 {sortLabels[appliedQuery.primarySortKey]} {appliedQuery.primarySortDirection === "asc" ? "오름차순" : "내림차순"}, {sortLabels[appliedQuery.secondarySortKey]} {appliedQuery.secondarySortDirection === "asc" ? "오름차순" : "내림차순"}</p></div>
      <div className={styles.listHead}><div><h2>등지방 대장 내역</h2><p>측정일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"}</p></div><strong>조회 {filteredRows.length}건</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr><th>번호</th><th>측정일</th><th>모돈번호</th><th>이각번호</th><th>품종</th><th>산차</th><th>현재상태</th><th>측정시기</th><th>체중(kg)</th><th>등지방(mm)</th><th>비고</th></tr></thead><tbody>{filteredRows.length ? filteredRows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td className={styles.cycleDate}>{row.measurementDate}</td><td><strong>{row.animalNo}</strong></td><td>{row.earTag || "-"}</td><td>{row.breed || "-"}</td><td>{row.parity || "0"}</td><td><span className={styles.statusBadge}>{row.status || "-"}</span></td><td>{row.measurementTiming}{row.measurementTimingDetail ? ` (${row.measurementTimingDetail})` : ""}</td><td>{row.weight || "-"}</td><td>{row.backfat || "-"}</td><td>{row.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={11}>조회조건에 해당하는 등지방 기록이 없습니다.</td></tr>}</tbody></table></div>
    </section>
  </ReportShell>;
}
