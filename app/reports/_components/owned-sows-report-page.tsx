"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readStoredCullRecords } from "../../production/sows/_data/cull-records";
import { readStoredFarrowingRecords } from "../../production/sows/_data/farrowing-records";
import { readStoredIntakeRecords, SowIntakeRecord } from "../../production/sows/_data/intake-records";
import { readStoredMatingRecords } from "../../production/sows/_data/mating-records";
import { readStoredNursingPigletRecords } from "../../production/sows/_data/nursing-piglet-records";
import { readStoredPregnancyIncidentRecords } from "../../production/sows/_data/pregnancy-incident-records";
import { readStoredWeaningRecords } from "../../production/sows/_data/weaning-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

type SortKey = "animalNo" | "breed" | "parity" | "birthDate" | "intakeDate" | "currentStatus" | "lastWorkDate";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "후보돈" | "임신돈" | "포유돈" | "이유모돈" | "재발돈" | "사고돈";
type Query = { queryDate: string; status: StatusFilter; location: string; sortKey: SortKey; sortDirection: SortDirection };
type WorkEvent = { date: string; work: string; status: string; parity?: string; location?: string };
export type OwnedSowRow = SowIntakeRecord & { currentStatus: string; lastWorkDate: string; lastWork: string; currentLocation: string };

const TODAY = new Date().toISOString().slice(0, 10);
const INITIAL_QUERY: Query = { queryDate: TODAY, status: "all", location: "", sortKey: "animalNo", sortDirection: "asc" };
const STATUS_OPTIONS: Exclude<StatusFilter, "all">[] = ["후보돈", "임신돈", "포유돈", "이유모돈", "재발돈", "사고돈"];
const sortLabels: Record<SortKey, string> = { animalNo: "모돈번호", breed: "품종", parity: "산차", birthDate: "출생일", intakeDate: "전입일", currentStatus: "현재상태", lastWorkDate: "최종작업일" };

function compareRows(left: OwnedSowRow, right: OwnedSowRow, key: SortKey) {
  if (key === "parity") return Number(left.parity || 0) - Number(right.parity || 0);
  return String(left[key] ?? "").localeCompare(String(right[key] ?? ""), "ko", { numeric: true });
}

export default function OwnedSowsReportPage() {
  const [rows, setRows] = useState<OwnedSowRow[]>([]);
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    const intakes = readStoredIntakeRecords();
    const culls = readStoredCullRecords();
    const matings = readStoredMatingRecords();
    const incidents = readStoredPregnancyIncidentRecords();
    const farrowings = readStoredFarrowingRecords();
    const nursing = readStoredNursingPigletRecords();
    const weanings = readStoredWeaningRecords();
    const queryDate = appliedQuery.queryDate;

    const result = intakes.filter((intake) => intake.intakeDate <= queryDate && !culls.some((record) => record.animalNo === intake.animalNo && record.eventDate <= queryDate)).map((intake) => {
      const events: WorkEvent[] = [{ date: intake.intakeDate, work: "전입", status: intake.status || "후보돈", parity: intake.parity }];
      matings.filter((record) => record.animalNo === intake.animalNo && record.matingDate <= queryDate).forEach((record) => events.push({ date: record.matingDate, work: "교배", status: "임신돈", parity: record.parity, location: record.location }));
      incidents.filter((record) => record.animalNo === intake.animalNo && record.incidentDate <= queryDate).forEach((record) => events.push({ date: record.incidentDate, work: `임신사고(${record.cause})`, status: record.cause === "재발" ? "재발돈" : "사고돈", parity: record.parity, location: record.diagnosisLocation }));
      farrowings.filter((record) => record.animalNo === intake.animalNo && record.farrowingDate <= queryDate).forEach((record) => events.push({ date: record.farrowingDate, work: "분만", status: "포유돈", parity: record.parity, location: record.location }));
      nursing.filter((record) => record.animalNo === intake.animalNo && record.workDate <= queryDate).forEach((record) => events.push({ date: record.workDate, work: record.category, status: "포유돈", parity: record.parity }));
      weanings.filter((record) => record.animalNo === intake.animalNo && record.weaningDate <= queryDate).forEach((record) => events.push({ date: record.weaningDate, work: "이유", status: "이유모돈", parity: record.parity, location: record.sowMoveLocation }));
      events.sort((left, right) => left.date.localeCompare(right.date));
      const latest = events.at(-1)!;
      return { ...intake, parity: latest.parity || intake.parity, currentStatus: latest.status, lastWorkDate: latest.date, lastWork: latest.work, currentLocation: latest.location || "" };
    });
    setRows(result);
  }, [appliedQuery.queryDate]);

  const filteredRows = useMemo(() => rows.filter((row) => (appliedQuery.status === "all" || row.currentStatus === appliedQuery.status) && (!appliedQuery.location.trim() || row.currentLocation.toLowerCase().includes(appliedQuery.location.trim().toLowerCase()))).sort((left, right) => {
    const compared = compareRows(left, right, appliedQuery.sortKey);
    return appliedQuery.sortDirection === "asc" ? compared : -compared;
  }), [appliedQuery, rows]);

  function applyQuery() { setAppliedQuery(draftQuery); setExportError(""); }

  async function downloadExcel() {
    setExporting(true); setExportError("");
    try {
      const response = await fetch("/api/reports/owned-sows/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: filteredRows, query: appliedQuery, farmName: "참든팜" }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `보유모돈_${appliedQuery.queryDate}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setExportError(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const statusLabel = appliedQuery.status === "all" ? "전체" : appliedQuery.status;
  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 모돈리스트 / 보유모돈</p><h1>보유모돈</h1><span>조회일 현재 보유 중인 모돈의 상태와 최종 작업을 확인합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>보유모돈 보고서</h2><p>보고서 구분, 조회일, 장소와 정렬기준을 선택하세요.</p></div></div><span className={styles.newBadge}>생산 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서 구분</span><select value={draftQuery.status} onChange={(event) => setDraftQuery((query) => ({ ...query, status: event.target.value as StatusFilter }))}><option value="all">전체</option>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>조회일</span><input type="date" value={draftQuery.queryDate} onChange={(event) => setDraftQuery((query) => ({ ...query, queryDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>장소</span><input value={draftQuery.location} onChange={(event) => setDraftQuery((query) => ({ ...query, location: event.target.value }))} placeholder="현재 장소 입력" /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>정렬기준</span><select value={draftQuery.sortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, sortKey: event.target.value as SortKey }))}>{Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>정렬방향</span><select value={draftQuery.sortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, sortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{exportError ? <p className={styles.exportError}>{exportError}</p> : null}</div>
    </section>
    <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>보유모돈</h1><p>조회일 {appliedQuery.queryDate} · 구분 {statusLabel} · 정렬 {sortLabels[appliedQuery.sortKey]} {appliedQuery.sortDirection === "asc" ? "오름차순" : "내림차순"}</p></div>
      <div className={styles.listHead}><div><h2>보유모돈 내역</h2><p>조회일 {appliedQuery.queryDate} · 구분 {statusLabel}{appliedQuery.location ? ` · 장소 ${appliedQuery.location}` : ""}</p></div><strong>조회 {filteredRows.length}두</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr><th>번호</th><th>모돈번호</th><th>이각번호</th><th>품종</th><th>산차</th><th>출생일</th><th>전입일</th><th>최종작업일</th><th>최종작업</th><th>현재상태</th><th>구입처</th><th>현재장소</th></tr></thead><tbody>{filteredRows.length ? filteredRows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><strong>{row.animalNo}</strong></td><td>{row.earTag || "-"}</td><td>{row.breed || "-"}</td><td>{row.parity || "0"}</td><td>{row.birthDate || "-"}</td><td>{row.intakeDate || "-"}</td><td className={styles.cycleDate}>{row.lastWorkDate || "-"}</td><td>{row.lastWork || "-"}</td><td><span className={styles.statusBadge}>{row.currentStatus || "-"}</span></td><td>{row.source || "-"}</td><td>{row.currentLocation || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={12}>조회조건에 해당하는 보유모돈이 없습니다.</td></tr>}</tbody></table></div>
    </section>
  </ReportShell>;
}
