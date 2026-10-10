"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readStoredIntakeRecords, SowIntakeRecord } from "../../production/sows/_data/intake-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

type SortKey = "animalNo" | "earTag" | "parity" | "breed" | "birthDate";
type SortDirection = "asc" | "desc";
type Query = { fromDate: string; toDate: string; sortKey: SortKey; sortDirection: SortDirection };

const TODAY = new Date().toISOString().slice(0, 10);
const THIRTY_DAYS_AGO = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
const INITIAL_QUERY: Query = { fromDate: THIRTY_DAYS_AGO, toDate: TODAY, sortKey: "animalNo", sortDirection: "asc" };

const sortLabels: Record<SortKey, string> = {
  animalNo: "모돈번호",
  earTag: "이각번호",
  parity: "산차",
  breed: "품종",
  birthDate: "출생일",
};

function compareRecords(left: SowIntakeRecord, right: SowIntakeRecord, sortKey: SortKey) {
  if (sortKey === "parity") return Number(left.parity || 0) - Number(right.parity || 0);
  return String(left[sortKey] ?? "").localeCompare(String(right[sortKey] ?? ""), "ko", { numeric: true });
}

export default function SowIntakeLedgerPage() {
  const [records, setRecords] = useState<SowIntakeRecord[]>([]);
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => { setRecords(readStoredIntakeRecords()); }, []);

  const filteredRecords = useMemo(() => records
    .filter((record) => (!appliedQuery.fromDate || record.intakeDate >= appliedQuery.fromDate) && (!appliedQuery.toDate || record.intakeDate <= appliedQuery.toDate))
    .sort((left, right) => {
      const compared = compareRecords(left, right, appliedQuery.sortKey);
      return appliedQuery.sortDirection === "asc" ? compared : -compared;
    }), [appliedQuery, records]);

  function applyQuery() {
    setAppliedQuery(draftQuery);
    setExportError("");
  }

  async function downloadExcel() {
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch("/api/reports/sow-intake/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: filteredRecords, query: appliedQuery, farmName: "참든팜" }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." }));
        throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `모돈전입대장_${appliedQuery.fromDate || "전체"}_${appliedQuery.toDate || "전체"}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다.");
    } finally {
      setExporting(false);
    }
  }

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}>
      <div><p>보고서 / 작업대장 / 모돈전입대장</p><h1>모돈전입대장</h1><span>모돈 전입 기록을 기간별로 조회하고 지정한 기준으로 정렬해 출력합니다.</span></div>
    </section>

    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>전입대장 조회</h2><p>조회기간과 정렬기준을 선택한 뒤 조회하세요.</p></div></div><span className={styles.newBadge}>전입 기록 연결</span></div>
      <div className={styles.formSection}>
        <div className={styles.reportFilterGrid}>
          <label className={styles.field}><span className={styles.fieldLabel}>전입일 시작</span><input type="date" value={draftQuery.fromDate} onChange={(event) => setDraftQuery((query) => ({ ...query, fromDate: event.target.value }))} /></label>
          <label className={styles.field}><span className={styles.fieldLabel}>전입일 종료</span><input type="date" value={draftQuery.toDate} onChange={(event) => setDraftQuery((query) => ({ ...query, toDate: event.target.value }))} /></label>
          <label className={styles.field}><span className={styles.fieldLabel}>정렬기준</span><select value={draftQuery.sortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, sortKey: event.target.value as SortKey }))}>{Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className={styles.field}><span className={styles.fieldLabel}>정렬방향</span><select value={draftQuery.sortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, sortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
          <div className={styles.reportActionButtons}>
            <button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button>
            <button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button>
            <button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button>
          </div>
        </div>
        {exportError ? <p className={styles.exportError}>{exportError}</p> : null}
      </div>
    </section>

    <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>모돈전입대장</h1><p>조회기간 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"} · 정렬 {sortLabels[appliedQuery.sortKey]} {appliedQuery.sortDirection === "asc" ? "오름차순" : "내림차순"}</p></div>
      <div className={styles.listHead}><div><h2>모돈전입대장 내역</h2><p>전입일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"}</p></div><strong>조회 {filteredRecords.length}건</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr><th>번호</th><th>모돈번호</th><th>이각번호</th><th>품종</th><th>산차</th><th>출생일</th><th>전입일</th><th>전입체중(kg)</th><th>전입상태</th><th>구입처</th><th>비고</th></tr></thead><tbody>{filteredRecords.length ? filteredRecords.map((record, index) => <tr key={record.id}><td>{index + 1}</td><td><strong>{record.animalNo}</strong></td><td>{record.earTag || "-"}</td><td>{record.breed || "-"}</td><td>{record.parity || "0"}</td><td>{record.birthDate || "-"}</td><td className={styles.cycleDate}>{record.intakeDate}</td><td>{record.weight || "-"}</td><td><span className={styles.statusBadge}>{record.status || "-"}</span></td><td>{record.source || "-"}</td><td>{record.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={11}>조회기간에 해당하는 모돈 전입 기록이 없습니다.</td></tr>}</tbody></table></div>
    </section>
  </ReportShell>;
}