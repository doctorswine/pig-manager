"use client";

import { CalendarDays, ClipboardList, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readStoredBoarCullRecords } from "../../production/boars/_data/cull-records";
import { readStoredBoarIntakeRecords } from "../../production/boars/_data/intake-records";
import { readStoredFatteningGroupClosureRecords } from "../../production/fattening-groups/_data/closure-records";
import { readStoredFatteningGroupRecords } from "../../production/fattening-groups/_data/group-records";
import { readStoredFatteningMortalityRecords } from "../../production/fattening-groups/_data/mortality-records";
import { readStoredMovementIntakeRecords } from "../../production/fattening-groups/_data/movement-intake-records";
import { readStoredFatteningOutboundRecords } from "../../production/fattening-groups/_data/outbound-records";
import { readStoredBackfatRecords } from "../../production/sows/_data/backfat-records";
import { readStoredCullRecords } from "../../production/sows/_data/cull-records";
import { readStoredFarrowingRecords } from "../../production/sows/_data/farrowing-records";
import { readStoredFirstEstrusRecords } from "../../production/sows/_data/first-estrus-records";
import { readStoredIntakeRecords } from "../../production/sows/_data/intake-records";
import { readStoredMatingRecords } from "../../production/sows/_data/mating-records";
import { readStoredNursingPigletRecords } from "../../production/sows/_data/nursing-piglet-records";
import { readStoredPregnancyIncidentRecords } from "../../production/sows/_data/pregnancy-incident-records";
import { readStoredWeaningRecords } from "../../production/sows/_data/weaning-records";
import styles from "../../production/sows/intake/page.module.css";
import { workLedgerMenus, WorkLedgerMenuKey } from "../_data/report-menus";
import ReportShell from "./report-shell";

type LedgerArea = "모돈" | "웅돈" | "비육돈";
type WorkLedgerRow = {
  id: string; workDate: string; area: LedgerArea; workType: string; targetNo: string; earTag: string;
  stage: string; count: string; location: string; detail: string; note: string;
};

const PAGE_SIZE = 10;
const TODAY = new Date().toISOString().slice(0, 10);
const THIRTY_DAYS_AGO = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);

const ledgerMatchers: Record<WorkLedgerMenuKey, (row: WorkLedgerRow) => boolean> = {
  "sow-intake": (row) => row.area === "모돈" && row.workType === "전입",
  "boar-intake": (row) => row.area === "웅돈" && row.workType === "전입",
  estrus: (row) => row.area === "모돈" && row.workType === "초발정",
  mating: (row) => row.area === "모돈" && row.workType === "교배",
  farrowing: (row) => row.area === "모돈" && row.workType === "분만",
  "pregnancy-incident": (row) => row.area === "모돈" && row.workType === "임신사고",
  weaning: (row) => row.area === "모돈" && row.workType === "이유",
  "nursing-piglets": (row) => row.area === "모돈" && ["포유자돈폐사", "부분이유", "양자전입", "양자전출"].includes(row.workType),
  backfat: (row) => row.area === "모돈" && row.workType === "등지방측정",
  cull: (row) => row.area === "모돈" && ["도태", "폐사", "전출", "판매"].includes(row.workType),
  fattening: (row) => row.area === "비육돈",
};

function pairCount(female: string, male: string) {
  return `${female || "0"} / ${male || "0"}`;
}

function loadLedgerRows(): WorkLedgerRow[] {
  const rows: WorkLedgerRow[] = [];
  readStoredIntakeRecords().forEach((record) => rows.push({ id: `sow-intake-${record.id}`, workDate: record.intakeDate, area: "모돈", workType: "전입", targetNo: record.animalNo, earTag: record.earTag, stage: `${record.parity || "0"}산`, count: "-", location: record.source, detail: `${record.breed}${record.weight ? ` · ${record.weight}kg` : ""}`, note: record.note ?? "" }));
  readStoredFirstEstrusRecords().forEach((record) => record.cycles.forEach((cycle, index) => { if (cycle.heatDate) rows.push({ id: `estrus-${record.id}-${index}`, workDate: cycle.heatDate, area: "모돈", workType: "초발정", targetNo: record.animalNo, earTag: record.earTag, stage: `${index + 1}차`, count: "-", location: "-", detail: `${cycle.intensity}${cycle.weight ? ` · ${cycle.weight}kg` : ""}${cycle.backfat ? ` · ${cycle.backfat}mm` : ""}`, note: cycle.note }); }));
  readStoredMatingRecords().forEach((record) => rows.push({ id: `mating-${record.id}`, workDate: record.matingDate, area: "모돈", workType: "교배", targetNo: record.animalNo, earTag: record.earTag, stage: `${record.parity || "0"}산`, count: "-", location: record.location, detail: [record.boar1, record.boar2, record.boar3].filter(Boolean).join(", ") || record.method1, note: [record.worker, record.note].filter(Boolean).join(" · ") }));
  readStoredPregnancyIncidentRecords().forEach((record) => rows.push({ id: `pregnancy-incident-${record.id}`, workDate: record.incidentDate, area: "모돈", workType: "임신사고", targetNo: record.animalNo, earTag: record.earTag, stage: `${record.parity || "0"}산`, count: "-", location: record.diagnosisLocation || "-", detail: `${record.cause}${record.matingDate ? ` · 교배 ${record.matingDate}` : ""}`, note: record.note }));
  readStoredFarrowingRecords().forEach((record) => rows.push({ id: `farrowing-${record.id}`, workDate: record.farrowingDate, area: "모돈", workType: "분만", targetNo: record.animalNo, earTag: record.earTag, stage: `${record.parity || "0"}산`, count: pairCount(record.liveFemale, record.liveMale), location: record.location, detail: `총산 ${record.totalBorn || "0"} · 포유개시 ${record.nursingStart || "0"}`, note: record.note }));
  readStoredNursingPigletRecords().forEach((record) => rows.push({ id: `nursing-${record.id}`, workDate: record.workDate, area: "모돈", workType: record.category, targetNo: record.animalNo, earTag: record.earTag, stage: `${record.parity || "0"}산 · ${record.pigletAge || "0"}일`, count: pairCount(record.femaleCount, record.maleCount), location: "-", detail: record.cause || (record.weight ? `${record.weight}kg` : "-"), note: record.note }));
  readStoredWeaningRecords().forEach((record) => rows.push({ id: `weaning-${record.id}`, workDate: record.weaningDate, area: "모돈", workType: "이유", targetNo: record.animalNo, earTag: record.earTag, stage: `${record.parity || "0"}산 · ${record.weaningAge || "0"}일`, count: pairCount(record.femaleCount, record.maleCount), location: record.pigletMoveDestination || record.sowMoveLocation, detail: record.totalWeight ? `총 ${record.totalWeight}kg` : "-", note: record.note }));
  readStoredBackfatRecords().forEach((record) => rows.push({ id: `backfat-${record.id}`, workDate: record.measurementDate, area: "모돈", workType: "등지방측정", targetNo: record.animalNo, earTag: record.earTag, stage: `${record.parity || "0"}산`, count: "-", location: record.status, detail: `${record.measurementTiming}${record.measurementTimingDetail ? `(${record.measurementTimingDetail})` : ""} · ${record.backfat}mm${record.weight ? ` · ${record.weight}kg` : ""}`, note: record.note }));
  readStoredCullRecords().forEach((record) => rows.push({ id: `sow-cull-${record.id}`, workDate: record.eventDate, area: "모돈", workType: record.type, targetNo: record.animalNo, earTag: record.earTag, stage: `${record.parity || "0"}산`, count: "-", location: record.buyer || "-", detail: `${record.cause}${record.weight ? ` · ${record.weight}kg` : ""}`, note: record.note }));

  readStoredBoarIntakeRecords().forEach((record) => rows.push({ id: `boar-intake-${record.id}`, workDate: record.intakeDate, area: "웅돈", workType: "전입", targetNo: record.animalNo, earTag: record.earTag, stage: record.boarType, count: "-", location: record.source, detail: `${record.breed}${record.weight ? ` · ${record.weight}kg` : ""}`, note: record.note }));
  readStoredBoarCullRecords().forEach((record) => rows.push({ id: `boar-cull-${record.id}`, workDate: record.eventDate, area: "웅돈", workType: record.type, targetNo: record.animalNo, earTag: record.earTag, stage: record.boarType, count: "-", location: record.buyer || "-", detail: `${record.cause}${record.weight ? ` · ${record.weight}kg` : ""}`, note: record.note }));

  readStoredFatteningGroupRecords().forEach((record) => rows.push({ id: `group-${record.id}`, workDate: record.startDate, area: "비육돈", workType: "그룹등록", targetNo: record.groupId, earTag: "-", stage: `${record.startAge || "0"}일령`, count: pairCount(record.femaleCount, record.maleCount), location: record.location, detail: `${record.sex} · ${record.breed}`, note: record.note }));
  readStoredMovementIntakeRecords().forEach((record) => rows.push({ id: `movement-${record.id}`, workDate: record.intakeDate, area: "비육돈", workType: "이동전입", targetNo: record.groupId, earTag: "-", stage: `${record.intakeAge || "0"}일령`, count: pairCount(record.femaleCount, record.maleCount), location: record.sourceGroupId || "-", detail: `${record.movementType}${record.totalWeight ? ` · ${record.totalWeight}kg` : ""}`, note: record.note }));
  readStoredFatteningMortalityRecords().forEach((record) => rows.push({ id: `mortality-${record.id}`, workDate: record.mortalityDate, area: "비육돈", workType: "폐사", targetNo: record.groupId, earTag: "-", stage: `${record.mortalityAge || "0"}일령`, count: pairCount(record.femaleCount, record.maleCount), location: "-", detail: `${record.cause}${record.totalWeight ? ` · ${record.totalWeight}kg` : ""}`, note: record.note }));
  readStoredFatteningOutboundRecords().forEach((record) => rows.push({ id: `outbound-${record.id}`, workDate: record.actionDate, area: "비육돈", workType: record.category, targetNo: record.groupId, earTag: "-", stage: `${record.actionAge || "0"}일령`, count: pairCount(record.femaleCount, record.maleCount), location: record.partner || "-", detail: `${record.movementType}${record.liveWeight ? ` · ${record.liveWeight}kg` : ""}`, note: record.note }));
  readStoredFatteningGroupClosureRecords().forEach((record) => rows.push({ id: `closure-${record.id}`, workDate: record.closureDate, area: "비육돈", workType: "그룹종료", targetNo: record.groupId, earTag: "-", stage: "-", count: "-", location: "-", detail: "그룹 작업 종료", note: record.note }));

  return rows.sort((left, right) => right.workDate.localeCompare(left.workDate) || right.id.localeCompare(left.id));
}

export default function WorkLedgerPage({ ledgerKey }: { ledgerKey?: WorkLedgerMenuKey }) {
  const activeLedger = ledgerKey ? workLedgerMenus.find((menu) => menu.key === ledgerKey) : undefined;
  const [rows, setRows] = useState<WorkLedgerRow[]>([]);
  const [fromDate, setFromDate] = useState(THIRTY_DAYS_AGO);
  const [toDate, setToDate] = useState(TODAY);
  const [area, setArea] = useState<"전체" | LedgerArea>("전체");
  const [workType, setWorkType] = useState("전체");
  const [keyword, setKeyword] = useState("");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);

  useEffect(() => { setRows(loadLedgerRows()); }, []);

  const workTypes = useMemo(() => Array.from(new Set(rows.map((row) => row.workType))).sort((a, b) => a.localeCompare(b, "ko")), [rows]);
  const filteredRows = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return rows.filter((row) => (!ledgerKey || ledgerMatchers[ledgerKey](row)) && (!fromDate || row.workDate >= fromDate) && (!toDate || row.workDate <= toDate) && (area === "전체" || row.area === area) && (workType === "전체" || row.workType === workType) && (!query || `${row.area} ${row.workType} ${row.targetNo} ${row.earTag} ${row.location} ${row.detail} ${row.note}`.toLowerCase().includes(query)))
      .sort((left, right) => sortDirection === "desc" ? right.workDate.localeCompare(left.workDate) : left.workDate.localeCompare(right.workDate));
  }, [area, fromDate, keyword, ledgerKey, rows, sortDirection, toDate, workType]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageWindowStart = Math.min(Math.max(1, currentPage - 2), Math.max(1, pageCount - 4));
  const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, index) => pageWindowStart + index);
  const counts = { total: filteredRows.length, sow: filteredRows.filter((row) => row.area === "모돈").length, boar: filteredRows.filter((row) => row.area === "웅돈").length, fattening: filteredRows.filter((row) => row.area === "비육돈").length };
  function resetPage() { setPage(1); }

  return <ReportShell>
    <section className={styles.heading}><div><p>보고서 / 작업대장{activeLedger ? ` / ${activeLedger.label}` : ""}</p><h1>{activeLedger?.label ?? "작업대장"}</h1><span>{activeLedger ? `${activeLedger.label}에 해당하는 생산 기록만 날짜순으로 조회합니다.` : "생산관리에서 등록한 모돈·웅돈·비육돈 작업을 날짜순으로 통합 조회합니다."}</span></div></section>
    <section className={styles.formCard}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><ClipboardList size={18} /></span><div><h2>작업 조회 조건</h2><p>조회 조건을 바꾸면 작업대장 목록에 즉시 반영됩니다.</p></div></div><span className={styles.newBadge}>실제 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.formGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>작업일 시작</span><input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); resetPage(); }} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>작업일 종료</span><input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); resetPage(); }} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>관리구분</span><select value={area} onChange={(event) => { setArea(event.target.value as "전체" | LedgerArea); resetPage(); }}><option>전체</option><option>모돈</option><option>웅돈</option><option>비육돈</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>작업구분</span><select value={workType} onChange={(event) => { setWorkType(event.target.value); resetPage(); }}><option>전체</option>{workTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>정렬</span><select value={sortDirection} onChange={(event) => { setSortDirection(event.target.value as "desc" | "asc"); resetPage(); }}><option value="desc">작업일 내림차순</option><option value="asc">작업일 오름차순</option></select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>통합검색</span><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#7b8b85" }} /><input style={{ paddingLeft: 36 }} value={keyword} onChange={(event) => { setKeyword(event.target.value); resetPage(); }} placeholder="개체번호, 그룹, 장소, 상세내용" /></div></label>
      </div></div>
    </section>
    <section className={styles.listCard}>
      <div className={styles.listHead}><div><h2>{activeLedger?.label ?? "작업대장"} 내역</h2><p><CalendarDays size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />{fromDate || "전체"} ~ {toDate || "전체"}</p></div><strong>총 {counts.total}건 · 모돈 {counts.sow} · 웅돈 {counts.boar} · 비육돈 {counts.fattening}</strong></div>
      <div className={styles.tableWrap}><table><thead><tr><th>번호</th><th>작업일</th><th>관리구분</th><th>작업구분</th><th>대상번호</th><th>이각번호</th><th>산차/일령</th><th>두수(암/수)</th><th>장소/거래처</th><th>상세</th><th>비고</th></tr></thead><tbody>{pagedRows.length ? pagedRows.map((row, index) => <tr key={row.id}><td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td><td className={styles.cycleDate}>{row.workDate}</td><td><span className={styles.statusBadge}>{row.area}</span></td><td>{row.workType}</td><td><strong>{row.targetNo}</strong></td><td>{row.earTag || "-"}</td><td>{row.stage || "-"}</td><td>{row.count}</td><td>{row.location || "-"}</td><td>{row.detail || "-"}</td><td>{row.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={11}>조건에 맞는 작업 기록이 없습니다.</td></tr>}</tbody></table></div>
      <div className={styles.pagination}><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>이전</button>{pageNumbers.map((pageNumber) => pageNumber === currentPage ? <strong key={pageNumber}>{pageNumber}</strong> : <button type="button" key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}<button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>다음</button></div>
    </section>
  </ReportShell>;
}