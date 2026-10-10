"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EstrusRecord, readStoredFirstEstrusRecords } from "../../production/sows/_data/first-estrus-records";
import { readStoredIntakeRecords } from "../../production/sows/_data/intake-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

export type EstrusLedgerRow = {
  id: string;
  animalNo: string;
  earTag: string;
  breed: string;
  birthDate: string;
  cycleNo: number;
  heatDate: string;
  intensity: string;
  weight: string;
  backfat: string;
  note: string;
};

type SortKey = "animalNo" | "earTag" | "heatDate" | "birthDate";
type SortDirection = "asc" | "desc";
type Query = { fromDate: string; toDate: string; sortKey: SortKey; sortDirection: SortDirection };

const TODAY = new Date().toISOString().slice(0, 10);
const THIRTY_DAYS_AGO = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
const INITIAL_QUERY: Query = { fromDate: THIRTY_DAYS_AGO, toDate: TODAY, sortKey: "heatDate", sortDirection: "asc" };
const sortLabels: Record<SortKey, string> = { animalNo: "모돈번호", earTag: "이각번호", heatDate: "발정일", birthDate: "출생일" };

function flattenRecords(records: EstrusRecord[]): EstrusLedgerRow[] {
  const intakeRecords = readStoredIntakeRecords();
  return records.flatMap((record) => {
    const intake = intakeRecords.find((item) => item.animalNo === record.animalNo) ?? intakeRecords.find((item) => item.earTag && item.earTag === record.earTag);
    return record.cycles.flatMap((cycle, index) => cycle.heatDate ? [{
      id: `${record.id}-${index}`,
      animalNo: record.animalNo,
      earTag: record.earTag,
      breed: record.breed,
      birthDate: intake?.birthDate ?? "",
      cycleNo: index + 1,
      heatDate: cycle.heatDate,
      intensity: cycle.intensity,
      weight: cycle.weight,
      backfat: cycle.backfat,
      note: cycle.note,
    }] : []);
  });
}

function compareRows(left: EstrusLedgerRow, right: EstrusLedgerRow, sortKey: SortKey) {
  return String(left[sortKey] ?? "").localeCompare(String(right[sortKey] ?? ""), "ko", { numeric: true });
}

export default function EstrusLedgerPage() {
  const [rows, setRows] = useState<EstrusLedgerRow[]>([]);
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => { setRows(flattenRecords(readStoredFirstEstrusRecords())); }, []);

  const filteredRows = useMemo(() => rows
    .filter((row) => (!appliedQuery.fromDate || row.heatDate >= appliedQuery.fromDate) && (!appliedQuery.toDate || row.heatDate <= appliedQuery.toDate))
    .sort((left, right) => {
      const compared = compareRows(left, right, appliedQuery.sortKey);
      return appliedQuery.sortDirection === "asc" ? compared : -compared;
    }), [appliedQuery, rows]);

  function applyQuery() { setAppliedQuery(draftQuery); setExportError(""); }

  async function downloadExcel() {
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch("/api/reports/estrus/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: filteredRows, query: appliedQuery, farmName: "참든팜" }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." }));
        throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `초발정대장_${appliedQuery.fromDate || "전체"}_${appliedQuery.toDate || "전체"}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다.");
    } finally { setExporting(false); }
  }

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 작업대장 / 초발정대장</p><h1>초발정대장</h1><span>모돈의 초발정 기록을 기간별로 조회하고 지정한 기준으로 정렬해 출력합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>초발정대장 조회</h2><p>발정일과 정렬기준을 선택한 뒤 조회하세요.</p></div></div><span className={styles.newBadge}>초발정 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>발정일 시작</span><input type="date" value={draftQuery.fromDate} onChange={(event) => setDraftQuery((query) => ({ ...query, fromDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>발정일 종료</span><input type="date" value={draftQuery.toDate} onChange={(event) => setDraftQuery((query) => ({ ...query, toDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>정렬기준</span><select value={draftQuery.sortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, sortKey: event.target.value as SortKey }))}>{Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>정렬방향</span><select value={draftQuery.sortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, sortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{exportError ? <p className={styles.exportError}>{exportError}</p> : null}</div>
    </section>
    <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>초발정대장</h1><p>조회기간 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"} · 정렬 {sortLabels[appliedQuery.sortKey]} {appliedQuery.sortDirection === "asc" ? "오름차순" : "내림차순"}</p></div>
      <div className={styles.listHead}><div><h2>초발정대장 내역</h2><p>발정일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"}</p></div><strong>조회 {filteredRows.length}건</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr><th>번호</th><th>모돈번호</th><th>이각번호</th><th>품종</th><th>출생일</th><th>차수</th><th>발정일</th><th>발정강도</th><th>체중(kg)</th><th>등지방(mm)</th><th>비고</th></tr></thead><tbody>{filteredRows.length ? filteredRows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><strong>{row.animalNo}</strong></td><td>{row.earTag || "-"}</td><td>{row.breed || "-"}</td><td>{row.birthDate || "-"}</td><td>{row.cycleNo}차</td><td className={styles.cycleDate}>{row.heatDate}</td><td><span className={styles.statusBadge}>{row.intensity || "-"}</span></td><td>{row.weight || "-"}</td><td>{row.backfat || "-"}</td><td>{row.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={11}>조회기간에 해당하는 초발정 기록이 없습니다.</td></tr>}</tbody></table></div>
    </section>
  </ReportShell>;
}