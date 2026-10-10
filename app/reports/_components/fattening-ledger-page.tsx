"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readStoredFatteningGroupRecords } from "../../production/fattening-groups/_data/group-records";
import { MOVEMENT_INTAKE_TYPES, readStoredMovementIntakeRecords } from "../../production/fattening-groups/_data/movement-intake-records";
import { FATTENING_MORTALITY_CAUSES, readStoredFatteningMortalityRecords } from "../../production/fattening-groups/_data/mortality-records";
import { readStoredFatteningOutboundRecords, SHIPMENT_TYPES, TRANSFER_TYPES } from "../../production/fattening-groups/_data/outbound-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

type WorkType = "전입" | "폐사" | "전출" | "출하";
type SortKey = "workDate" | "workType" | "detailType" | "groupId" | "age" | "totalCount";
type SortDirection = "asc" | "desc";
type Row = { id: string; workDate: string; workType: WorkType; detailType: string; groupId: string; age: number; femaleCount: number; maleCount: number; totalCount: number; partner: string; liveWeight: number | null; carcassWeight: number | null; amount: number | null; note: string };
type Query = { fromDate: string; toDate: string; workType: "all" | WorkType; detailType: string; groupId: string; primarySortKey: SortKey; primarySortDirection: SortDirection; secondarySortKey: SortKey; secondarySortDirection: SortDirection };

const TODAY = new Date().toISOString().slice(0, 10);
const THIRTY_DAYS_AGO = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
const INITIAL_QUERY: Query = { fromDate: THIRTY_DAYS_AGO, toDate: TODAY, workType: "all", detailType: "all", groupId: "all", primarySortKey: "workDate", primarySortDirection: "desc", secondarySortKey: "groupId", secondarySortDirection: "asc" };
const sortLabels: Record<SortKey, string> = { workDate: "작업일", workType: "구분", detailType: "상세구분", groupId: "그룹ID", age: "일령", totalCount: "두수" };
const workTypes: WorkType[] = ["전입", "폐사", "전출", "출하"];
const detailMap: Record<WorkType, readonly string[]> = { "전입": MOVEMENT_INTAKE_TYPES, "폐사": FATTENING_MORTALITY_CAUSES, "전출": TRANSFER_TYPES, "출하": SHIPMENT_TYPES };
const numberValue = (value: string | undefined) => Number(value || 0);

function readRows(): Row[] {
  const intakeRows: Row[] = readStoredMovementIntakeRecords().map((record) => ({ id: `intake-${record.id}`, workDate: record.intakeDate, workType: "전입", detailType: record.movementType, groupId: record.groupId, age: numberValue(record.intakeAge), femaleCount: numberValue(record.femaleCount), maleCount: numberValue(record.maleCount), totalCount: numberValue(record.femaleCount) + numberValue(record.maleCount), partner: record.sourceGroupId, liveWeight: record.totalWeight ? numberValue(record.totalWeight) : null, carcassWeight: null, amount: null, note: record.note }));
  const mortalityRows: Row[] = readStoredFatteningMortalityRecords().map((record) => ({ id: `mortality-${record.id}`, workDate: record.mortalityDate, workType: "폐사", detailType: record.cause, groupId: record.groupId, age: numberValue(record.mortalityAge), femaleCount: numberValue(record.femaleCount), maleCount: numberValue(record.maleCount), totalCount: numberValue(record.femaleCount) + numberValue(record.maleCount), partner: "", liveWeight: record.totalWeight ? numberValue(record.totalWeight) : null, carcassWeight: null, amount: null, note: record.note }));
  const outboundRows: Row[] = readStoredFatteningOutboundRecords().map((record) => ({ id: `outbound-${record.id}`, workDate: record.actionDate, workType: record.category, detailType: record.movementType, groupId: record.groupId, age: numberValue(record.actionAge), femaleCount: numberValue(record.femaleCount), maleCount: numberValue(record.maleCount), totalCount: numberValue(record.femaleCount) + numberValue(record.maleCount), partner: record.partner, liveWeight: record.liveWeight ? numberValue(record.liveWeight) : null, carcassWeight: record.carcassWeight ? numberValue(record.carcassWeight) : null, amount: record.amount ? numberValue(record.amount) : null, note: record.note }));
  return [...intakeRows, ...mortalityRows, ...outboundRows];
}
function compareRows(left: Row, right: Row, key: SortKey) {
  if (key === "age" || key === "totalCount") return left[key] - right[key];
  return String(left[key] ?? "").localeCompare(String(right[key] ?? ""), "ko", { numeric: true });
}
function compareByQuery(left: Row, right: Row, query: Query) {
  const primary = compareRows(left, right, query.primarySortKey) * (query.primarySortDirection === "asc" ? 1 : -1);
  return primary || compareRows(left, right, query.secondarySortKey) * (query.secondarySortDirection === "asc" ? 1 : -1);
}

export default function FatteningLedgerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  useEffect(() => { const loaded = readRows(); setRows(loaded); setGroupIds(Array.from(new Set([...readStoredFatteningGroupRecords().map((record) => record.groupId), ...loaded.map((row) => row.groupId)])).filter(Boolean).sort((a, b) => a.localeCompare(b, "ko", { numeric: true }))); }, []);
  const detailOptions = useMemo(() => draftQuery.workType === "all" ? Array.from(new Set(Object.values(detailMap).flat())) : [...detailMap[draftQuery.workType]], [draftQuery.workType]);
  const filteredRows = useMemo(() => rows.filter((row) => (!appliedQuery.fromDate || row.workDate >= appliedQuery.fromDate) && (!appliedQuery.toDate || row.workDate <= appliedQuery.toDate) && (appliedQuery.workType === "all" || row.workType === appliedQuery.workType) && (appliedQuery.detailType === "all" || row.detailType === appliedQuery.detailType) && (appliedQuery.groupId === "all" || row.groupId === appliedQuery.groupId)).sort((left, right) => compareByQuery(left, right, appliedQuery)), [appliedQuery, rows]);

  function changeWorkType(value: Query["workType"]) { setDraftQuery((query) => ({ ...query, workType: value, detailType: "all" })); }
  function applyQuery() { setAppliedQuery(draftQuery); setExportError(""); }
  async function downloadExcel() {
    setExporting(true); setExportError("");
    try {
      const response = await fetch("/api/reports/fattening-work/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: filteredRows, query: appliedQuery, farmName: "참든팜" }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `비육돈작업대장_${appliedQuery.fromDate || "전체"}_${appliedQuery.toDate || "전체"}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setExportError(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const sortOptions = Object.entries(sortLabels);
  const workTypeLabel = appliedQuery.workType === "all" ? "전체" : appliedQuery.workType;
  const detailLabel = appliedQuery.detailType === "all" ? "전체" : appliedQuery.detailType;
  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 작업대장 / 비육돈 작업대장</p><h1>비육돈 작업대장</h1><span>비육돈 그룹의 전입·폐사·전출·출하 기록을 하나의 대장에서 조회합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>비육돈 작업대장 조회</h2><p>작업구분에 따라 두수관리와 동일한 상세구분이 표시됩니다.</p></div></div><span className={styles.newBadge}>두수관리 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>조회 시작일</span><input type="date" value={draftQuery.fromDate} onChange={(event) => setDraftQuery((query) => ({ ...query, fromDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>조회 종료일</span><input type="date" value={draftQuery.toDate} onChange={(event) => setDraftQuery((query) => ({ ...query, toDate: event.target.value }))} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>작업구분</span><select value={draftQuery.workType} onChange={(event) => changeWorkType(event.target.value as Query["workType"])}><option value="all">전체</option>{workTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>상세구분</span><select value={draftQuery.detailType} onChange={(event) => setDraftQuery((query) => ({ ...query, detailType: event.target.value }))}><option value="all">전체</option>{detailOptions.map((detail) => <option key={detail} value={detail}>{detail}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>그룹ID</span><select value={draftQuery.groupId} onChange={(event) => setDraftQuery((query) => ({ ...query, groupId: event.target.value }))}><option value="all">전체</option>{groupIds.map((groupId) => <option key={groupId} value={groupId}>{groupId}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬기준</span><select value={draftQuery.primarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬방향</span><select value={draftQuery.primarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, primarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬기준</span><select value={draftQuery.secondarySortKey} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortKey: event.target.value as SortKey }))}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬방향</span><select value={draftQuery.secondarySortDirection} onChange={(event) => setDraftQuery((query) => ({ ...query, secondarySortDirection: event.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{exportError ? <p className={styles.exportError}>{exportError}</p> : null}</div>
    </section>
    <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>비육돈 작업대장</h1><p>조회기간 {appliedQuery.fromDate || "전체"} ~ {appliedQuery.toDate || "전체"} · 구분 {workTypeLabel} / {detailLabel} · 정렬 {sortLabels[appliedQuery.primarySortKey]} {appliedQuery.primarySortDirection === "asc" ? "오름차순" : "내림차순"}, {sortLabels[appliedQuery.secondarySortKey]} {appliedQuery.secondarySortDirection === "asc" ? "오름차순" : "내림차순"}</p></div>
      <div className={styles.listHead}><div><h2>비육돈 작업 내역</h2><p>{workTypeLabel} · {detailLabel} · {appliedQuery.groupId === "all" ? "전체 그룹" : appliedQuery.groupId}</p></div><strong>조회 {filteredRows.length}건</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr><th>번호</th><th>구분</th><th>상세구분</th><th>그룹ID</th><th>작업일</th><th>일령</th><th>거래처/출처</th><th>암</th><th>수</th><th>두수</th><th>생체중(kg)</th><th>지육체중(kg)</th><th>금액(원)</th><th>비고</th></tr></thead><tbody>{filteredRows.length ? filteredRows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><span className={styles.statusBadge}>{row.workType}</span></td><td>{row.detailType}</td><td><strong>{row.groupId}</strong></td><td className={styles.cycleDate}>{row.workDate}</td><td>{row.age}</td><td>{row.partner || "-"}</td><td>{row.femaleCount}</td><td>{row.maleCount}</td><td>{row.totalCount}</td><td>{row.liveWeight == null ? "-" : row.liveWeight.toLocaleString("ko-KR")}</td><td>{row.carcassWeight == null ? "-" : row.carcassWeight.toLocaleString("ko-KR")}</td><td>{row.amount == null ? "-" : row.amount.toLocaleString("ko-KR")}</td><td>{row.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={14}>조회조건에 해당하는 비육돈 작업 기록이 없습니다.</td></tr>}</tbody></table></div>
    </section>
  </ReportShell>;
}
