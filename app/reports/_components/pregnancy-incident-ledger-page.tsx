"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PregnancyIncidentRecord, readStoredPregnancyIncidentRecords } from "../../production/sows/_data/pregnancy-incident-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

type SortKey = "incidentDate" | "matingDate" | "incidentDays" | "parity" | "cause" | "animalNo" | "earTag";
type SortDirection = "asc" | "desc";
type Query = { fromDate: string; toDate: string; primarySortKey: SortKey; primarySortDirection: SortDirection; secondarySortKey: SortKey; secondarySortDirection: SortDirection };

const TODAY = new Date().toISOString().slice(0, 10);
const THIRTY_DAYS_AGO = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
const INITIAL_QUERY: Query = { fromDate: THIRTY_DAYS_AGO, toDate: TODAY, primarySortKey: "incidentDate", primarySortDirection: "desc", secondarySortKey: "animalNo", secondarySortDirection: "asc" };
const sortLabels: Record<SortKey, string> = { incidentDate: "임신사고일", matingDate: "교배일", incidentDays: "사고일수", parity: "산차", cause: "임신사고원인", animalNo: "모돈번호", earTag: "이각번호" };

function elapsedDays(matingDate: string, incidentDate: string) {
  if (!matingDate || !incidentDate) return null;
  const start = Date.parse(`${matingDate}T00:00:00Z`);
  const end = Date.parse(`${incidentDate}T00:00:00Z`);
  const days = Math.floor((end - start) / 86_400_000);
  return Number.isFinite(days) && days >= 0 ? days : null;
}

function compareRecords(left: PregnancyIncidentRecord, right: PregnancyIncidentRecord, sortKey: SortKey) {
  if (sortKey === "parity") return Number(left.parity || 0) - Number(right.parity || 0);
  if (sortKey === "incidentDays") return Number(elapsedDays(left.matingDate, left.incidentDate) ?? Number.MAX_SAFE_INTEGER) - Number(elapsedDays(right.matingDate, right.incidentDate) ?? Number.MAX_SAFE_INTEGER);
  return String(left[sortKey] ?? "").localeCompare(String(right[sortKey] ?? ""), "ko", { numeric: true });
}

function compareByQuery(left: PregnancyIncidentRecord, right: PregnancyIncidentRecord, query: Query) {
  const primary = compareRecords(left, right, query.primarySortKey) * (query.primarySortDirection === "asc" ? 1 : -1);
  if (primary) return primary;
  return compareRecords(left, right, query.secondarySortKey) * (query.secondarySortDirection === "asc" ? 1 : -1);
}

export default function PregnancyIncidentLedgerPage() {
  const [records, setRecords] = useState<PregnancyIncidentRecord[]>([]);
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => { setRecords(readStoredPregnancyIncidentRecords()); }, []);

  const filteredRecords = useMemo(() => records
    .filter((record) => (!appliedQuery.fromDate || record.incidentDate >= appliedQuery.fromDate) && (!appliedQuery.toDate || record.incidentDate <= appliedQuery.toDate))
    .sort((left, right) => compareByQuery(left, right, appliedQuery)), [appliedQuery, records]);

  function applyQuery() { setAppliedQuery(draftQuery); setExportError(""); }

  async function downloadExcel() {
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch("/api/reports/pregnancy-incident/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: filteredRecords, query: appliedQuery, farmName: "참든팜" }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." }));
        throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `임신진단_사고대장_${appliedQuery.fromDate || "전체"}_${appliedQuery.toDate || "전체"}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) { setExportError(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); }
    finally { setExporting(false); }
  }

  const sortOptions = Object.entries(sortLabels);
  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 작업대장 / 임신진단 사고대장</p><h1>임신진단 사고대장</h1><span>교배 이후 발생한 임신사고 기록을 기간별로 조회하고 두 단계 기준으로 정렬합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>임신진단 사고대장 조회</h2><p>사고일과 1·2차 정렬기준을 선택하세요.</p></div></div><span className={styles.newBadge}>임신사고 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서 구분</span><select value="pregnancy-incident" disabled><option value="pregnancy-incident">임신진단 사고대장</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>사고일 시작</span><input type="date" value={draftQuery.fromDate} onChange={(event) => setDraftQuery((query) => ({ ...query, fromDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>사고일 종료</span><input type="date" value={draftQuery.toDate} onChange={(event) => setDraftQuery((query) => ({ ...query, toDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬기준</span><select value={draftQuery.primarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬방향</span><select value={draftQuery.primarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬기준</span><select value={draftQuery.secondarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬방향</span><select value={draftQuery.secondarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{exportError ? <p className={styles.exportError}>{exportError}</p> : null}</div>
    </section>
    <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>임신진단 사고대장</h1><p>사고일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"} · 정렬 {sortLabels[appliedQuery.primarySortKey]} {appliedQuery.primarySortDirection === "asc" ? "오름차순" : "내림차순"}, {sortLabels[appliedQuery.secondarySortKey]} {appliedQuery.secondarySortDirection === "asc" ? "오름차순" : "내림차순"}</p></div>
      <div className={styles.listHead}><div><h2>임신진단 사고대장 내역</h2><p>사고일 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"}</p></div><strong>조회 {filteredRecords.length}건</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr><th>번호</th><th>임신사고일</th><th>모돈번호</th><th>이각번호</th><th>품종</th><th>산차</th><th>교배일</th><th>사고일수</th><th>임신사고원인</th><th>진단 장소</th><th>비고</th></tr></thead><tbody>{filteredRecords.length ? filteredRecords.map((record, index) => { const elapsed = elapsedDays(record.matingDate, record.incidentDate); return <tr key={record.id}><td>{index + 1}</td><td className={styles.cycleDate}>{record.incidentDate}</td><td><strong>{record.animalNo}</strong></td><td>{record.earTag || "-"}</td><td>{record.breed || "-"}</td><td>{record.parity || "0"}</td><td>{record.matingDate || "-"}</td><td>{elapsed == null ? "-" : `${elapsed}일`}</td><td><span className={styles.statusBadge}>{record.cause || "-"}</span></td><td>{record.diagnosisLocation || "-"}</td><td>{record.note || "-"}</td></tr>; }) : <tr><td className={styles.emptyTable} colSpan={11}>조회조건에 해당하는 임신사고 기록이 없습니다.</td></tr>}</tbody></table></div>
    </section>
  </ReportShell>;
}