"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FarrowingRecord, readStoredFarrowingRecords } from "../../production/sows/_data/farrowing-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

type SortKey = "farrowingDate" | "matingDate" | "animalNo" | "breed" | "parity" | "totalBorn" | "liveBorn" | "mummified" | "stillborn";
type SortDirection = "asc" | "desc";
type Query = { fromDate: string; toDate: string; primarySortKey: SortKey; primarySortDirection: SortDirection; secondarySortKey: SortKey; secondarySortDirection: SortDirection };

const TODAY = new Date().toISOString().slice(0, 10);
const THIRTY_DAYS_AGO = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
const INITIAL_QUERY: Query = { fromDate: THIRTY_DAYS_AGO, toDate: TODAY, primarySortKey: "farrowingDate", primarySortDirection: "desc", secondarySortKey: "animalNo", secondarySortDirection: "asc" };
const sortLabels: Record<SortKey, string> = { farrowingDate: "분만일", matingDate: "교배일", animalNo: "모돈번호", breed: "품종", parity: "산차", totalBorn: "총산", liveBorn: "실산", mummified: "미라", stillborn: "사산" };

function numericValue(record: FarrowingRecord, sortKey: SortKey) {
  if (sortKey === "liveBorn") return Number(record.liveFemale || 0) + Number(record.liveMale || 0);
  if (["parity", "totalBorn", "mummified", "stillborn"].includes(sortKey)) return Number(record[sortKey as "parity" | "totalBorn" | "mummified" | "stillborn"] || 0);
  return null;
}
function daysBetween(fromDate: string, toDate: string) {
  if (!fromDate || !toDate) return null;
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  const days = Math.floor((to - from) / 86_400_000);
  return Number.isFinite(days) && days >= 0 ? days : null;
}
function liveBorn(record: FarrowingRecord) { return Number(record.liveFemale || 0) + Number(record.liveMale || 0); }
function birthCull(record: FarrowingRecord) { return Number(record.cullSmall || 0) + Number(record.cullDeformity || 0) + Number(record.cullOther || 0); }
function compareRecords(left: FarrowingRecord, right: FarrowingRecord, sortKey: SortKey) {
  const leftNumber = numericValue(left, sortKey);
  const rightNumber = numericValue(right, sortKey);
  if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber;
  return String(left[sortKey as keyof FarrowingRecord] ?? "").localeCompare(String(right[sortKey as keyof FarrowingRecord] ?? ""), "ko", { numeric: true });
}
function compareByQuery(left: FarrowingRecord, right: FarrowingRecord, query: Query) {
  const primary = compareRecords(left, right, query.primarySortKey) * (query.primarySortDirection === "asc" ? 1 : -1);
  if (primary) return primary;
  return compareRecords(left, right, query.secondarySortKey) * (query.secondarySortDirection === "asc" ? 1 : -1);
}

export default function FarrowingLedgerPage() {
  const [records, setRecords] = useState<FarrowingRecord[]>([]);
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => { setRecords(readStoredFarrowingRecords()); }, []);
  const filteredRecords = useMemo(() => records
    .filter((record) => (!appliedQuery.fromDate || record.farrowingDate >= appliedQuery.fromDate) && (!appliedQuery.toDate || record.farrowingDate <= appliedQuery.toDate))
    .sort((left, right) => compareByQuery(left, right, appliedQuery)), [appliedQuery, records]);

  function applyQuery() { setAppliedQuery(draftQuery); setExportError(""); }
  async function downloadExcel() {
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch("/api/reports/farrowing/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: filteredRecords, query: appliedQuery, farmName: "참든팜" }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." }));
        throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `분만대장_${appliedQuery.fromDate || "전체"}_${appliedQuery.toDate || "전체"}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) { setExportError(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); }
    finally { setExporting(false); }
  }

  const sortOptions = Object.entries(sortLabels);
  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 작업대장 / 분만대장</p><h1>분만대장</h1><span>저장된 분만 기록을 기간별로 조회하고 두 단계 기준으로 정렬합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>분만대장 조회</h2><p>분만일과 1·2차 정렬기준을 선택하세요.</p></div></div><span className={styles.newBadge}>분만 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서 구분</span><select value="farrowing" disabled><option value="farrowing">분만대장</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>분만일 시작</span><input type="date" value={draftQuery.fromDate} onChange={(event) => setDraftQuery((query) => ({ ...query, fromDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>분만일 종료</span><input type="date" value={draftQuery.toDate} onChange={(event) => setDraftQuery((query) => ({ ...query, toDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬기준</span><select value={draftQuery.primarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬방향</span><select value={draftQuery.primarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬기준</span><select value={draftQuery.secondarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬방향</span><select value={draftQuery.secondarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{exportError ? <p className={styles.exportError}>{exportError}</p> : null}</div>
    </section>
    <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>분만대장</h1><p>분만일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"} · 정렬 {sortLabels[appliedQuery.primarySortKey]} {appliedQuery.primarySortDirection === "asc" ? "오름차순" : "내림차순"}, {sortLabels[appliedQuery.secondarySortKey]} {appliedQuery.secondarySortDirection === "asc" ? "오름차순" : "내림차순"}</p></div>
      <div className={styles.listHead}><div><h2>분만대장 내역</h2><p>분만일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"}</p></div><strong>조회 {filteredRecords.length}건</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr><th>번호</th><th>분만일</th><th>모돈번호</th><th>이각번호</th><th>품종</th><th>산차</th><th>교배일</th><th>임신일수</th><th>분만구분</th><th>총산</th><th>실산</th><th>미라</th><th>사산</th><th>생시도태</th><th>포유개시</th><th>평균생시체중</th><th>총생시체중</th><th>분만장소</th><th>비고</th></tr></thead><tbody>{filteredRecords.length ? filteredRecords.map((record, index) => <tr key={record.id}><td>{index + 1}</td><td className={styles.cycleDate}>{record.farrowingDate}</td><td><strong>{record.animalNo}</strong></td><td>{record.earTag || "-"}</td><td>{record.breed || "-"}</td><td>{record.parity || "0"}</td><td>{record.matingDate || "-"}</td><td>{daysBetween(record.matingDate, record.farrowingDate) ?? "-"}</td><td><span className={styles.statusBadge}>{record.farrowingType || "-"}</span></td><td>{record.totalBorn || "0"}</td><td>{liveBorn(record)}</td><td>{record.mummified || "0"}</td><td>{record.stillborn || "0"}</td><td>{birthCull(record)}</td><td>{record.nursingStart || "0"}</td><td>{record.averageBirthWeight || "-"}</td><td>{record.totalBirthWeight || "-"}</td><td>{record.location || "-"}</td><td>{record.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={19}>조회조건에 해당하는 분만 기록이 없습니다.</td></tr>}</tbody></table></div>
    </section>
  </ReportShell>;
}