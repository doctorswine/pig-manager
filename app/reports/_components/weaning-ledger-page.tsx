"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readStoredFarrowingRecords } from "../../production/sows/_data/farrowing-records";
import { readStoredWeaningRecords, WeaningRecord } from "../../production/sows/_data/weaning-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

export type WeaningLedgerRow = WeaningRecord & { matingDate: string; breed: string; nursingPeriod: number | null; weaningTotal: number };
type SortKey = "weaningDate" | "farrowingDate" | "matingDate" | "animalNo" | "earTag" | "parity" | "nursingPeriod" | "weaningTotal";
type SortDirection = "asc" | "desc";
type Query = { fromDate: string; toDate: string; primarySortKey: SortKey; primarySortDirection: SortDirection; secondarySortKey: SortKey; secondarySortDirection: SortDirection };

const TODAY = new Date().toISOString().slice(0, 10);
const THIRTY_DAYS_AGO = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
const INITIAL_QUERY: Query = { fromDate: THIRTY_DAYS_AGO, toDate: TODAY, primarySortKey: "weaningDate", primarySortDirection: "desc", secondarySortKey: "animalNo", secondarySortDirection: "asc" };
const sortLabels: Record<SortKey, string> = { weaningDate: "이유일", farrowingDate: "분만일", matingDate: "교배일", animalNo: "모돈번호", earTag: "이각번호", parity: "산차", nursingPeriod: "포유기간", weaningTotal: "이유두수" };

function daysBetween(fromDate: string, toDate: string) {
  if (!fromDate || !toDate) return null;
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  const days = Math.floor((to - from) / 86_400_000);
  return Number.isFinite(days) && days >= 0 ? days : null;
}
function enrichRecords(records: WeaningRecord[]): WeaningLedgerRow[] {
  const farrowings = readStoredFarrowingRecords();
  return records.map((record) => {
    const farrowing = farrowings.find((item) => item.animalNo === record.animalNo && item.farrowingDate === record.farrowingDate);
    const storedPeriod = record.weaningAge === "" ? null : Number(record.weaningAge);
    return { ...record, matingDate: farrowing?.matingDate ?? "", breed: farrowing?.breed ?? "", nursingPeriod: storedPeriod !== null && Number.isFinite(storedPeriod) ? storedPeriod : daysBetween(record.farrowingDate, record.weaningDate), weaningTotal: Number(record.femaleCount || 0) + Number(record.maleCount || 0) };
  });
}
function compareRows(left: WeaningLedgerRow, right: WeaningLedgerRow, sortKey: SortKey) {
  if (["parity", "nursingPeriod", "weaningTotal"].includes(sortKey)) return Number(left[sortKey as "parity" | "nursingPeriod" | "weaningTotal"] ?? Number.MAX_SAFE_INTEGER) - Number(right[sortKey as "parity" | "nursingPeriod" | "weaningTotal"] ?? Number.MAX_SAFE_INTEGER);
  return String(left[sortKey] ?? "").localeCompare(String(right[sortKey] ?? ""), "ko", { numeric: true });
}
function compareByQuery(left: WeaningLedgerRow, right: WeaningLedgerRow, query: Query) {
  const primary = compareRows(left, right, query.primarySortKey) * (query.primarySortDirection === "asc" ? 1 : -1);
  if (primary) return primary;
  return compareRows(left, right, query.secondarySortKey) * (query.secondarySortDirection === "asc" ? 1 : -1);
}

export default function WeaningLedgerPage() {
  const [rows, setRows] = useState<WeaningLedgerRow[]>([]);
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => { setRows(enrichRecords(readStoredWeaningRecords())); }, []);
  const filteredRows = useMemo(() => rows
    .filter((row) => (!appliedQuery.fromDate || row.weaningDate >= appliedQuery.fromDate) && (!appliedQuery.toDate || row.weaningDate <= appliedQuery.toDate))
    .sort((left, right) => compareByQuery(left, right, appliedQuery)), [appliedQuery, rows]);

  function applyQuery() { setAppliedQuery(draftQuery); setExportError(""); }
  async function downloadExcel() {
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch("/api/reports/weaning/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: filteredRows, query: appliedQuery, farmName: "참든팜" }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." }));
        throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `이유대장_${appliedQuery.fromDate || "전체"}_${appliedQuery.toDate || "전체"}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) { setExportError(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); }
    finally { setExporting(false); }
  }

  const sortOptions = Object.entries(sortLabels);
  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 번식대장 / 이유대장</p><h1>이유대장</h1><span>저장된 이유 기록을 기간별로 조회하고 두 단계 기준으로 정렬합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>이유대장 조회</h2><p>이유일과 1·2차 정렬기준을 선택하세요.</p></div></div><span className={styles.newBadge}>이유 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서 구분</span><select value="weaning" disabled><option value="weaning">이유대장</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>이유일 시작</span><input type="date" value={draftQuery.fromDate} onChange={(event) => setDraftQuery((query) => ({ ...query, fromDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>이유일 종료</span><input type="date" value={draftQuery.toDate} onChange={(event) => setDraftQuery((query) => ({ ...query, toDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬기준</span><select value={draftQuery.primarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬방향</span><select value={draftQuery.primarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬기준</span><select value={draftQuery.secondarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬방향</span><select value={draftQuery.secondarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{exportError ? <p className={styles.exportError}>{exportError}</p> : null}</div>
    </section>
    <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>이유대장</h1><p>이유일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"} · 정렬 {sortLabels[appliedQuery.primarySortKey]} {appliedQuery.primarySortDirection === "asc" ? "오름차순" : "내림차순"}, {sortLabels[appliedQuery.secondarySortKey]} {appliedQuery.secondarySortDirection === "asc" ? "오름차순" : "내림차순"}</p></div>
      <div className={styles.listHead}><div><h2>이유대장 내역</h2><p>이유일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"}</p></div><strong>조회 {filteredRows.length}건</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr><th>번호</th><th>이유일</th><th>모돈번호</th><th>이각번호</th><th>품종</th><th>산차</th><th>교배일</th><th>분만일</th><th>포유기간</th><th>이유 암</th><th>이유 수</th><th>이유두수</th><th>평균체중</th><th>총체중</th><th>잔여두수(암/수)</th><th>재포유(암/수)</th><th>모돈 이동</th><th>자돈 이동</th><th>비고</th></tr></thead><tbody>{filteredRows.length ? filteredRows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td className={styles.cycleDate}>{row.weaningDate}</td><td><strong>{row.animalNo}</strong></td><td>{row.earTag || "-"}</td><td>{row.breed || "-"}</td><td>{row.parity || "0"}</td><td>{row.matingDate || "-"}</td><td>{row.farrowingDate || "-"}</td><td>{row.nursingPeriod == null ? "-" : `${row.nursingPeriod}일`}</td><td>{row.femaleCount || "0"}</td><td>{row.maleCount || "0"}</td><td>{row.weaningTotal}</td><td>{row.averageWeight ? `${row.averageWeight}kg` : "-"}</td><td>{row.totalWeight ? `${row.totalWeight}kg` : "-"}</td><td>{row.remainingFemale || "0"} / {row.remainingMale || "0"}</td><td>{row.reNursingFemale || "0"} / {row.reNursingMale || "0"}</td><td>{row.sowMoveLocation || "-"}</td><td>{row.pigletMoveDestination || "-"}</td><td>{row.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={19}>조회조건에 해당하는 이유 기록이 없습니다.</td></tr>}</tbody></table></div>
    </section>
  </ReportShell>;
}