"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NursingPigletCategory, NursingPigletRecord, readStoredNursingPigletRecords } from "../../production/sows/_data/nursing-piglet-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

type ReportType = "all" | NursingPigletCategory;
type SortKey = "workDate" | "farrowingDate" | "animalNo" | "earTag" | "parity" | "pigletAge" | "category" | "totalCount";
type SortDirection = "asc" | "desc";
type Query = { reportType: ReportType; fromDate: string; toDate: string; primarySortKey: SortKey; primarySortDirection: SortDirection; secondarySortKey: SortKey; secondarySortDirection: SortDirection };

const TODAY = new Date().toISOString().slice(0, 10);
const THIRTY_DAYS_AGO = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
const INITIAL_QUERY: Query = { reportType: "all", fromDate: THIRTY_DAYS_AGO, toDate: TODAY, primarySortKey: "workDate", primarySortDirection: "desc", secondarySortKey: "animalNo", secondarySortDirection: "asc" };
const reportLabels: Record<ReportType, string> = { all: "전체 포유자돈대장", 포유자돈폐사: "포유자돈 폐사대장", 부분이유: "부분이유대장", 양자전입: "양자전입대장", 양자전출: "양자전출대장" };
const sortLabels: Record<SortKey, string> = { workDate: "작업일", farrowingDate: "분만일", animalNo: "모돈번호", earTag: "이각번호", parity: "산차", pigletAge: "일령", category: "구분", totalCount: "두수" };

function totalCount(record: NursingPigletRecord) { return Number(record.femaleCount || 0) + Number(record.maleCount || 0); }
function compareRecords(left: NursingPigletRecord, right: NursingPigletRecord, sortKey: SortKey) {
  if (sortKey === "totalCount") return totalCount(left) - totalCount(right);
  if (sortKey === "parity" || sortKey === "pigletAge") return Number(left[sortKey] || 0) - Number(right[sortKey] || 0);
  return String(left[sortKey] ?? "").localeCompare(String(right[sortKey] ?? ""), "ko", { numeric: true });
}
function compareByQuery(left: NursingPigletRecord, right: NursingPigletRecord, query: Query) {
  const primary = compareRecords(left, right, query.primarySortKey) * (query.primarySortDirection === "asc" ? 1 : -1);
  if (primary) return primary;
  return compareRecords(left, right, query.secondarySortKey) * (query.secondarySortDirection === "asc" ? 1 : -1);
}

export default function NursingPigletLedgerPage() {
  const [records, setRecords] = useState<NursingPigletRecord[]>([]);
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => { setRecords(readStoredNursingPigletRecords()); }, []);
  const filteredRecords = useMemo(() => records
    .filter((record) => (!appliedQuery.fromDate || record.workDate >= appliedQuery.fromDate) && (!appliedQuery.toDate || record.workDate <= appliedQuery.toDate))
    .filter((record) => appliedQuery.reportType === "all" || record.category === appliedQuery.reportType)
    .sort((left, right) => compareByQuery(left, right, appliedQuery)), [appliedQuery, records]);

  function applyQuery() { setAppliedQuery(draftQuery); setExportError(""); }
  async function downloadExcel() {
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch("/api/reports/nursing-piglets/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: filteredRecords, query: appliedQuery, farmName: "참든팜" }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." }));
        throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${reportLabels[appliedQuery.reportType]}_${appliedQuery.fromDate || "전체"}_${appliedQuery.toDate || "전체"}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) { setExportError(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); }
    finally { setExporting(false); }
  }

  const sortOptions = Object.entries(sortLabels);
  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 작업대장 / 포유자돈대장</p><h1>포유자돈대장</h1><span>폐사·부분이유·양자전입·양자전출 기록을 한 대장에서 조회합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>포유자돈대장 조회</h2><p>보고서 구분, 작업일과 1·2차 정렬기준을 선택하세요.</p></div></div><span className={styles.newBadge}>포유자돈 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서 구분</span><select value={draftQuery.reportType} onChange={(event) => setDraftQuery((query) => ({ ...query, reportType: event.target.value as ReportType }))}>{Object.entries(reportLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>작업일 시작</span><input type="date" value={draftQuery.fromDate} onChange={(event) => setDraftQuery((query) => ({ ...query, fromDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>작업일 종료</span><input type="date" value={draftQuery.toDate} onChange={(event) => setDraftQuery((query) => ({ ...query, toDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬기준</span><select value={draftQuery.primarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬방향</span><select value={draftQuery.primarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬기준</span><select value={draftQuery.secondarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬방향</span><select value={draftQuery.secondarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{exportError ? <p className={styles.exportError}>{exportError}</p> : null}</div>
    </section>
    <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>{reportLabels[appliedQuery.reportType]}</h1><p>작업일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"} · 정렬 {sortLabels[appliedQuery.primarySortKey]} {appliedQuery.primarySortDirection === "asc" ? "오름차순" : "내림차순"}, {sortLabels[appliedQuery.secondarySortKey]} {appliedQuery.secondarySortDirection === "asc" ? "오름차순" : "내림차순"}</p></div>
      <div className={styles.listHead}><div><h2>{reportLabels[appliedQuery.reportType]} 내역</h2><p>작업일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"}</p></div><strong>조회 {filteredRecords.length}건</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr><th>번호</th><th>작업일</th><th>모돈번호</th><th>이각번호</th><th>산차</th><th>분만일</th><th>일령</th><th>구분</th><th>두수(암/수)</th><th>합계</th><th>원인</th><th>체중</th><th>비고</th></tr></thead><tbody>{filteredRecords.length ? filteredRecords.map((record, index) => <tr key={record.id}><td>{index + 1}</td><td className={styles.cycleDate}>{record.workDate}</td><td><strong>{record.animalNo}</strong></td><td>{record.earTag || "-"}</td><td>{record.parity || "0"}</td><td>{record.farrowingDate || "-"}</td><td>{record.pigletAge || "0"}</td><td><span className={styles.statusBadge}>{record.category}</span></td><td>{record.femaleCount || "0"} / {record.maleCount || "0"}</td><td>{totalCount(record)}</td><td>{record.cause || "-"}</td><td>{record.weight ? `${record.weight}kg` : "-"}</td><td>{record.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={13}>조회조건에 해당하는 포유자돈 기록이 없습니다.</td></tr>}</tbody></table></div>
    </section>
  </ReportShell>;
}