"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MatingRecord, readStoredMatingRecords } from "../../production/sows/_data/mating-records";
import { readStoredIntakeRecords } from "../../production/sows/_data/intake-records";
import { readStoredWeaningRecords } from "../../production/sows/_data/weaning-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

export type MatingLedgerRow = MatingRecord & {
  returnDays: number | null;
  expectedFarrowingDate: string;
};

type ReportType = "all" | "gilt" | "sow";
type SortKey = "matingDate" | "parity" | "returnDays" | "breed" | "animalNo" | "earTag";
type SortDirection = "asc" | "desc";
type Query = {
  reportType: ReportType;
  fromDate: string;
  toDate: string;
  primarySortKey: SortKey;
  primarySortDirection: SortDirection;
  secondarySortKey: SortKey;
  secondarySortDirection: SortDirection;
};

const TODAY = new Date().toISOString().slice(0, 10);
const THIRTY_DAYS_AGO = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
const INITIAL_QUERY: Query = { reportType: "all", fromDate: THIRTY_DAYS_AGO, toDate: TODAY, primarySortKey: "matingDate", primarySortDirection: "asc", secondarySortKey: "animalNo", secondarySortDirection: "asc" };
const reportLabels: Record<ReportType, string> = { all: "전체 교배대장", gilt: "후보돈 교배대장", sow: "경산돈 교배대장" };
const sortLabels: Record<SortKey, string> = { matingDate: "교배일", parity: "산차", returnDays: "재귀일(초교배일)", breed: "품종", animalNo: "모돈번호", earTag: "이각번호" };

function daysBetween(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  return Number.isFinite(days) && days >= 0 ? days : null;
}

function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function enrichRecords(records: MatingRecord[]): MatingLedgerRow[] {
  const intakeByAnimal = new Map(readStoredIntakeRecords().map((record) => [record.animalNo, record]));
  const weaningRecords = readStoredWeaningRecords();
  return records.map((record) => {
    const parity = Number(record.parity || 0);
    let baseDate = "";
    if (parity <= 0) baseDate = intakeByAnimal.get(record.animalNo)?.birthDate ?? "";
    else baseDate = weaningRecords
      .filter((item) => item.animalNo === record.animalNo && item.weaningDate <= record.matingDate)
      .sort((left, right) => right.weaningDate.localeCompare(left.weaningDate))[0]?.weaningDate ?? "";
    return { ...record, returnDays: baseDate ? daysBetween(baseDate, record.matingDate) : null, expectedFarrowingDate: addDays(record.matingDate, 114) };
  });
}

function compareRows(left: MatingLedgerRow, right: MatingLedgerRow, sortKey: SortKey) {
  if (sortKey === "parity" || sortKey === "returnDays") return Number(left[sortKey] ?? Number.MAX_SAFE_INTEGER) - Number(right[sortKey] ?? Number.MAX_SAFE_INTEGER);
  return String(left[sortKey] ?? "").localeCompare(String(right[sortKey] ?? ""), "ko", { numeric: true });
}

function compareByQuery(left: MatingLedgerRow, right: MatingLedgerRow, query: Query) {
  const primary = compareRows(left, right, query.primarySortKey) * (query.primarySortDirection === "asc" ? 1 : -1);
  if (primary) return primary;
  return compareRows(left, right, query.secondarySortKey) * (query.secondarySortDirection === "asc" ? 1 : -1);
}

export default function MatingLedgerPage() {
  const [rows, setRows] = useState<MatingLedgerRow[]>([]);
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => { setRows(enrichRecords(readStoredMatingRecords())); }, []);

  const filteredRows = useMemo(() => rows
    .filter((row) => (!appliedQuery.fromDate || row.matingDate >= appliedQuery.fromDate) && (!appliedQuery.toDate || row.matingDate <= appliedQuery.toDate))
    .filter((row) => appliedQuery.reportType === "all" || (appliedQuery.reportType === "gilt" ? Number(row.parity || 0) <= 0 : Number(row.parity || 0) > 0))
    .sort((left, right) => compareByQuery(left, right, appliedQuery)), [appliedQuery, rows]);

  function applyQuery() { setAppliedQuery(draftQuery); setExportError(""); }

  async function downloadExcel() {
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch("/api/reports/mating/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: filteredRows, query: appliedQuery, farmName: "참든팜" }) });
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
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 작업대장 / 교배대장</p><h1>교배대장</h1><span>전체·후보돈·경산돈 교배 기록을 조회하고 두 단계 기준으로 정렬합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>교배대장 조회</h2><p>보고서 구분과 교배일, 1·2차 정렬기준을 선택하세요.</p></div></div><span className={styles.newBadge}>교배 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서 구분</span><select value={draftQuery.reportType} onChange={(event) => setDraftQuery((query) => ({ ...query, reportType: event.target.value as ReportType }))}>{Object.entries(reportLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>교배일 시작</span><input type="date" value={draftQuery.fromDate} onChange={(event) => setDraftQuery((query) => ({ ...query, fromDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>교배일 종료</span><input type="date" value={draftQuery.toDate} onChange={(event) => setDraftQuery((query) => ({ ...query, toDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬기준</span><select value={draftQuery.primarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬방향</span><select value={draftQuery.primarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬기준</span><select value={draftQuery.secondarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬방향</span><select value={draftQuery.secondarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{exportError ? <p className={styles.exportError}>{exportError}</p> : null}</div>
    </section>
    <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>{reportLabels[appliedQuery.reportType]}</h1><p>교배일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"} · 정렬 {sortLabels[appliedQuery.primarySortKey]} {appliedQuery.primarySortDirection === "asc" ? "오름차순" : "내림차순"}, {sortLabels[appliedQuery.secondarySortKey]} {appliedQuery.secondarySortDirection === "asc" ? "오름차순" : "내림차순"}</p></div>
      <div className={styles.listHead}><div><h2>{reportLabels[appliedQuery.reportType]} 내역</h2><p>교배일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"}</p></div><strong>조회 {filteredRows.length}건</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr><th>번호</th><th>교배일</th><th>모돈번호</th><th>이각번호</th><th>품종</th><th>산차</th><th>재귀일(초교배일)</th><th>1차 웅돈/방법</th><th>2차 웅돈/방법</th><th>3차 웅돈/방법</th><th>교배자</th><th>분만예정일</th><th>비고</th></tr></thead><tbody>{filteredRows.length ? filteredRows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td className={styles.cycleDate}>{row.matingDate}</td><td><strong>{row.animalNo}</strong></td><td>{row.earTag || "-"}</td><td>{row.breed || "-"}</td><td>{row.parity || "0"}</td><td>{row.returnDays == null ? "-" : `${row.returnDays}일`}</td><td>{[row.boar1, row.method1].filter(Boolean).join(" / ") || "-"}</td><td>{[row.boar2, row.method2].filter(Boolean).join(" / ") || "-"}</td><td>{[row.boar3, row.method3].filter(Boolean).join(" / ") || "-"}</td><td>{row.worker || "-"}</td><td>{row.expectedFarrowingDate || "-"}</td><td>{row.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={13}>조회조건에 해당하는 교배 기록이 없습니다.</td></tr>}</tbody></table></div>
    </section>
  </ReportShell>;
}