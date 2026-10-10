"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CULL_TYPES, CullType, readStoredCullRecords, SowCullRecord } from "../../production/sows/_data/cull-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

type SortKey = "eventDate" | "parity" | "animalNo" | "earTag" | "type" | "cause" | "breed";
type SortDirection = "asc" | "desc";
type CullFilter = "all" | CullType;
type Query = { fromDate: string; toDate: string; cullType: CullFilter; primarySortKey: SortKey; primarySortDirection: SortDirection; secondarySortKey: SortKey; secondarySortDirection: SortDirection };
const TODAY = new Date().toISOString().slice(0, 10);
const THIRTY_DAYS_AGO = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
const INITIAL_QUERY: Query = { fromDate: THIRTY_DAYS_AGO, toDate: TODAY, cullType: "all", primarySortKey: "eventDate", primarySortDirection: "desc", secondarySortKey: "animalNo", secondarySortDirection: "asc" };
const sortLabels: Record<SortKey, string> = { eventDate: "도폐사일", parity: "산차", animalNo: "모돈번호", earTag: "이각번호", type: "도폐사구분", cause: "도폐사원인", breed: "품종" };
function compareRows(left: SowCullRecord, right: SowCullRecord, key: SortKey) {
  if (key === "parity") return Number(left.parity || 0) - Number(right.parity || 0);
  return String(left[key] ?? "").localeCompare(String(right[key] ?? ""), "ko", { numeric: true });
}
function compareByQuery(left: SowCullRecord, right: SowCullRecord, query: Query) {
  const primary = compareRows(left, right, query.primarySortKey) * (query.primarySortDirection === "asc" ? 1 : -1);
  return primary || compareRows(left, right, query.secondarySortKey) * (query.secondarySortDirection === "asc" ? 1 : -1);
}

export default function CullLedgerPage() {
  const [rows, setRows] = useState<SowCullRecord[]>([]);
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  useEffect(() => { setRows(readStoredCullRecords()); }, []);
  const filteredRows = useMemo(() => rows.filter((row) => (!appliedQuery.fromDate || row.eventDate >= appliedQuery.fromDate) && (!appliedQuery.toDate || row.eventDate <= appliedQuery.toDate) && (appliedQuery.cullType === "all" || row.type === appliedQuery.cullType)).sort((left, right) => compareByQuery(left, right, appliedQuery)), [appliedQuery, rows]);

  function applyQuery() { setAppliedQuery(draftQuery); setExportError(""); }
  async function downloadExcel() {
    setExporting(true); setExportError("");
    try {
      const response = await fetch("/api/reports/cull/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: filteredRows, query: appliedQuery, farmName: "참든팜" }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `도폐사대장_${appliedQuery.fromDate || "전체"}_${appliedQuery.toDate || "전체"}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setExportError(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const sortOptions = Object.entries(sortLabels);
  const cullTypeLabel = appliedQuery.cullType === "all" ? "전체" : appliedQuery.cullType;
  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 작업대장 / 도폐사 대장</p><h1>도폐사 대장</h1><span>저장된 도태·폐사·전출·판매 기록을 구분별로 조회하고 두 단계 기준으로 정렬합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>도폐사 대장 조회</h2><p>도폐사일, 구분과 1·2차 정렬기준을 선택하세요.</p></div></div><span className={styles.newBadge}>도폐사 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서 구분</span><select value="cull" disabled><option value="cull">도폐사 대장</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>도폐사 구분</span><select value={draftQuery.cullType} onChange={(event) => setDraftQuery((query) => ({ ...query, cullType: event.target.value as CullFilter }))}><option value="all">전체</option>{CULL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>도폐사일 시작</span><input type="date" value={draftQuery.fromDate} onChange={(event) => setDraftQuery((query) => ({ ...query, fromDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>도폐사일 종료</span><input type="date" value={draftQuery.toDate} onChange={(event) => setDraftQuery((query) => ({ ...query, toDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬기준</span><select value={draftQuery.primarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬방향</span><select value={draftQuery.primarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬기준</span><select value={draftQuery.secondarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬방향</span><select value={draftQuery.secondarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{exportError ? <p className={styles.exportError}>{exportError}</p> : null}</div>
    </section>
    <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>도폐사 대장</h1><p>도폐사일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"} · 구분 {cullTypeLabel} · 정렬 {sortLabels[appliedQuery.primarySortKey]} {appliedQuery.primarySortDirection === "asc" ? "오름차순" : "내림차순"}, {sortLabels[appliedQuery.secondarySortKey]} {appliedQuery.secondarySortDirection === "asc" ? "오름차순" : "내림차순"}</p></div>
      <div className={styles.listHead}><div><h2>도폐사 대장 내역</h2><p>도폐사일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"} · 구분 {cullTypeLabel}</p></div><strong>조회 {filteredRows.length}건</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr><th>번호</th><th>도폐사일</th><th>모돈번호</th><th>이각번호</th><th>품종</th><th>산차</th><th>도폐사 구분</th><th>도폐사원인</th><th>이전상태</th><th>체중(kg)</th><th>판매처/전출처</th><th>판매금액(원)</th><th>비고</th></tr></thead><tbody>{filteredRows.length ? filteredRows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td className={styles.cycleDate}>{row.eventDate}</td><td><strong>{row.animalNo}</strong></td><td>{row.earTag || "-"}</td><td>{row.breed || "-"}</td><td>{row.parity || "0"}</td><td><span className={styles.statusBadge}>{row.type}</span></td><td>{row.cause || "-"}</td><td>{row.previousStatus || "-"}</td><td>{row.weight || "-"}</td><td>{row.buyer || "-"}</td><td>{Number(row.saleAmount || 0).toLocaleString("ko-KR")}</td><td>{row.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={13}>조회조건에 해당하는 도폐사 기록이 없습니다.</td></tr>}</tbody></table></div>
    </section>
  </ReportShell>;
}
