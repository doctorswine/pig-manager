"use client";

import { ChevronLeft, ChevronRight, Download, FileText, Printer, Search } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { readStoredCullRecords } from "../../production/sows/_data/cull-records";
import { readStoredFarrowingRecords } from "../../production/sows/_data/farrowing-records";
import { readStoredFirstEstrusRecords } from "../../production/sows/_data/first-estrus-records";
import { readStoredIntakeRecords } from "../../production/sows/_data/intake-records";
import { readStoredMatingRecords } from "../../production/sows/_data/mating-records";
import { readStoredPregnancyIncidentRecords } from "../../production/sows/_data/pregnancy-incident-records";
import { readStoredWeaningRecords } from "../../production/sows/_data/weaning-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

export type WorkCategory = "mating" | "pregnancy-check" | "farrowing" | "weaning";
export type WorkSortKey = "elapsedDays" | "animalNo" | "parity" | "dueDate";
type SortDirection = "asc" | "desc";
type Query = { category: "all" | WorkCategory; startDate: string; endDate: string; sortKey1: WorkSortKey; sortDirection1: SortDirection; sortKey2: WorkSortKey | ""; sortDirection2: SortDirection };
// blank: 현장에서 손으로 적는 빈 칸(작업 기록지)
export type WorkColumn = { key: string; label: string; type?: "date" | "number" | "text" | "blank" };
export type WorkRow = { id: string; animalNo: string; parity: number; matingSequence: number; elapsedDays: number; dueDate: string; values: Record<string, string | number | null> };
export type WorkSection = { key: WorkCategory; title: string; criteria: string; columns: WorkColumn[]; rows: WorkRow[] };

// 작업 예정 기준일수
const GILT_MATING_DAYS = 240; // 후보돈: 출생 후 240일
const REMATING_DAYS = 5; // 이유 후 5일
const PREGNANCY_CHECK_DAY = 28; // 교배 후 28일(교배일 1일차)
const EXPECTED_FARROWING_DAY = 115; // 교배일 1일차 기준 115일째(교배일 + 114일)
const WEANING_DAYS = 28; // 분만 후 28일

export const workCategoryLabels: Record<WorkCategory, string> = { mating: "교배예정돈", "pregnancy-check": "임신진단예정돈", farrowing: "분만예정돈", weaning: "이유예정돈" };
export const workSortLabels: Record<WorkSortKey, string> = { elapsedDays: "경과일수", animalNo: "모돈번호", parity: "산차", dueDate: "예정일" };
const CATEGORY_ORDER = Object.keys(workCategoryLabels) as WorkCategory[];
const blank = (label: string): WorkColumn => ({ key: `blank-${label}`, label, type: "blank" });

const columnsByCategory: Record<WorkCategory, WorkColumn[]> = {
  mating: [{ key: "parityLabel", label: "산차" }, { key: "lastWork", label: "최종작업" }, { key: "lastWorkDate", label: "최종작업일", type: "date" }, { key: "elapsed", label: "경과일", type: "number" }, blank("교배일"), blank("웅돈1회"), blank("웅돈2회"), blank("웅돈3회"), blank("교배자"), blank("장소")],
  "pregnancy-check": [{ key: "parityLabel", label: "산차" }, { key: "matingDate", label: "교배일", type: "date" }, { key: "dueDate", label: "진단예정일", type: "date" }, { key: "elapsed", label: "임신일수", type: "number" }, blank("진단일"), blank("진단결과"), blank("진단자"), blank("비고")],
  farrowing: [{ key: "parityLabel", label: "산차" }, { key: "matingDate", label: "교배일", type: "date" }, { key: "dueDate", label: "분만예정일", type: "date" }, { key: "elapsed", label: "임신일수", type: "number" }, blank("분만일"), blank("총산"), blank("실산"), blank("사산"), blank("미라"), blank("장소")],
  weaning: [{ key: "parityLabel", label: "산차" }, { key: "farrowingDate", label: "분만일", type: "date" }, { key: "dueDate", label: "이유예정일", type: "date" }, { key: "elapsed", label: "포유일수", type: "number" }, blank("이유일"), blank("이유두수"), blank("이유체중"), blank("장소")],
};
const criteriaByCategory: Record<WorkCategory, string> = {
  mating: `후보돈 출생 후 ${GILT_MATING_DAYS}일 · 이유 후 ${REMATING_DAYS}일 · 임신사고 후 즉시, 기간 종료일까지 교배 예정(지난 예정 포함)`,
  "pregnancy-check": `교배 후 ${PREGNANCY_CHECK_DAY}일째 진단예정일이 조회기간 안에 있는 임신돈`,
  farrowing: `교배 후 ${EXPECTED_FARROWING_DAY}일째, 기간 종료일까지 분만 예정(지난 예정 포함)`,
  weaning: `분만 후 ${WEANING_DAYS}일, 기간 종료일까지 이유 예정(지난 예정 포함)`,
};

function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function addDays(text: string, days: number) { const date = new Date(`${text}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function isDate(value: string | undefined) { return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)); }

type Event = { date: string; rank: number; kind: "mating" | "incident" | "farrowing" | "weaning"; ref: number };

export function buildWorkSections(startDate: string, endDate: string): WorkSection[] {
  const intakes = readStoredIntakeRecords();
  const culls = readStoredCullRecords();
  const estrus = readStoredFirstEstrusRecords();
  const matings = readStoredMatingRecords();
  const incidents = readStoredPregnancyIncidentRecords();
  const farrowings = readStoredFarrowingRecords();
  const weanings = readStoredWeaningRecords();
  const sections: Record<WorkCategory, WorkRow[]> = { mating: [], "pregnancy-check": [], farrowing: [], weaning: [] };
  // 현재 상태는 조회기간 종료일까지의 기록으로 판단하고, 경과일수도 종료일 기준으로 센다.
  const asOf = endDate;

  intakes.filter((intake) => intake.intakeDate <= asOf && !culls.some((record) => record.animalNo === intake.animalNo && record.eventDate <= asOf)).forEach((intake) => {
    const animalNo = intake.animalNo;
    const ownMatings = matings.filter((record) => record.animalNo === animalNo && record.matingDate <= asOf);
    const events: Event[] = [
      // 같은 날짜에는 분만 → 이유 → 임신사고 → 교배 순서로 일어난 것으로 본다.
      ...farrowings.filter((record) => record.animalNo === animalNo && record.farrowingDate <= asOf).map((record) => ({ date: record.farrowingDate, rank: 1, kind: "farrowing" as const, ref: record.id })),
      ...weanings.filter((record) => record.animalNo === animalNo && record.weaningDate <= asOf).map((record) => ({ date: record.weaningDate, rank: 2, kind: "weaning" as const, ref: record.id })),
      ...incidents.filter((record) => record.animalNo === animalNo && record.incidentDate <= asOf).map((record) => ({ date: record.incidentDate, rank: 3, kind: "incident" as const, ref: record.id })),
      ...ownMatings.map((record) => ({ date: record.matingDate, rank: 4, kind: "mating" as const, ref: record.id })),
    ].sort((left, right) => left.date.localeCompare(right.date) || left.rank - right.rank || left.ref - right.ref);
    const latest = events.at(-1);
    const sequenceOf = (parity: number, matingId: number, matingDate: string) => ownMatings.filter((record) => num(record.parity) === parity && (record.matingDate < matingDate || (record.matingDate === matingDate && record.id <= matingId))).length;
    const push = (category: WorkCategory, row: Omit<WorkRow, "animalNo">) => sections[category].push({ ...row, animalNo });

    if (!latest) {
      // 교배 기록이 없는 후보돈: 출생 후 240일이 교배예정일
      if ((intake.status || "후보돈") !== "후보돈" || !isDate(intake.birthDate)) return;
      const dueDate = addDays(intake.birthDate, GILT_MATING_DAYS);
      if (dueDate > endDate) return;
      const heats = estrus.filter((record) => record.animalNo === animalNo).flatMap((record) => record.cycles.map((cycle) => cycle.heatDate)).filter((date) => isDate(date) && date <= asOf).sort();
      const lastHeat = heats.at(-1);
      const lastWorkDate = lastHeat && lastHeat > intake.intakeDate ? lastHeat : intake.intakeDate;
      const elapsed = daysBetween(lastWorkDate, asOf);
      push("mating", { id: `${animalNo}-g`, parity: 0, matingSequence: 0, elapsedDays: elapsed, dueDate, values: { parityLabel: "0-0", lastWork: lastHeat && lastHeat > intake.intakeDate ? "초발정" : "전입", lastWorkDate, elapsed } });
      return;
    }

    if (latest.kind === "weaning") {
      const weaning = weanings.find((record) => record.id === latest.ref)!;
      const dueDate = addDays(weaning.weaningDate, REMATING_DAYS);
      if (dueDate > endDate) return;
      const parity = num(weaning.parity); const elapsed = daysBetween(weaning.weaningDate, asOf);
      push("mating", { id: `${animalNo}-w${weaning.id}`, parity, matingSequence: 0, elapsedDays: elapsed, dueDate, values: { parityLabel: `${parity}-0`, lastWork: "이유", lastWorkDate: weaning.weaningDate, elapsed } });
    } else if (latest.kind === "incident") {
      const incident = incidents.find((record) => record.id === latest.ref)!;
      const mating = ownMatings.filter((record) => record.matingDate <= incident.incidentDate).sort((left, right) => right.matingDate.localeCompare(left.matingDate) || right.id - left.id)[0];
      const parity = num(mating?.parity ?? incident.parity); const sequence = mating ? sequenceOf(parity, mating.id, mating.matingDate) : 0;
      const elapsed = daysBetween(incident.incidentDate, asOf);
      push("mating", { id: `${animalNo}-i${incident.id}`, parity, matingSequence: sequence, elapsedDays: elapsed, dueDate: incident.incidentDate, values: { parityLabel: `${parity}-${sequence}`, lastWork: "사고", lastWorkDate: incident.incidentDate, elapsed } });
    } else if (latest.kind === "mating") {
      const mating = ownMatings.find((record) => record.id === latest.ref)!;
      const parity = num(mating.parity); const sequence = sequenceOf(parity, mating.id, mating.matingDate);
      const pregnancyDays = daysBetween(mating.matingDate, asOf) + 1; // 교배일 1일차
      const base = { parity, matingSequence: sequence, elapsedDays: pregnancyDays };
      const values = { parityLabel: `${parity}-${sequence}`, matingDate: mating.matingDate, elapsed: pregnancyDays };
      const checkDate = addDays(mating.matingDate, PREGNANCY_CHECK_DAY - 1);
      if (checkDate >= startDate && checkDate <= endDate) push("pregnancy-check", { id: `${animalNo}-p${mating.id}`, ...base, dueDate: checkDate, values: { ...values, dueDate: checkDate } });
      const farrowingDate = addDays(mating.matingDate, EXPECTED_FARROWING_DAY - 1);
      if (farrowingDate <= endDate) push("farrowing", { id: `${animalNo}-f${mating.id}`, ...base, dueDate: farrowingDate, values: { ...values, dueDate: farrowingDate } });
    } else {
      const farrowing = farrowings.find((record) => record.id === latest.ref)!;
      const dueDate = addDays(farrowing.farrowingDate, WEANING_DAYS);
      if (dueDate > endDate) return;
      const parity = num(farrowing.parity); const nursingDays = daysBetween(farrowing.farrowingDate, asOf);
      push("weaning", { id: `${animalNo}-n${farrowing.id}`, parity, matingSequence: 0, elapsedDays: nursingDays, dueDate, values: { parityLabel: `${parity}-0`, farrowingDate: farrowing.farrowingDate, dueDate, elapsed: nursingDays } });
    }
  });

  return CATEGORY_ORDER.map((key) => ({ key, title: workCategoryLabels[key], criteria: criteriaByCategory[key], columns: columnsByCategory[key], rows: sections[key] }));
}

function compareBy(left: WorkRow, right: WorkRow, key: WorkSortKey) {
  if (key === "elapsedDays") return left.elapsedDays - right.elapsedDays;
  if (key === "parity") return left.parity - right.parity || left.matingSequence - right.matingSequence;
  if (key === "dueDate") return left.dueDate.localeCompare(right.dueDate);
  return left.animalNo.localeCompare(right.animalNo, "ko", { numeric: true });
}

const INITIAL_QUERY: Query = { category: "all", startDate: "", endDate: "", sortKey1: "elapsedDays", sortDirection1: "desc", sortKey2: "", sortDirection2: "asc" };

export default function ScheduledWorkReportPage() {
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [baseSections, setBaseSections] = useState<WorkSection[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  // 날짜 기본값은 화면이 열린 뒤 브라우저 날짜로 채운다(오늘부터 7일 뒤까지).
  useEffect(() => {
    const today = localToday();
    const withDates = (query: Query) => ({ ...query, startDate: today, endDate: addDays(today, 7) });
    setDraftQuery(withDates); setAppliedQuery(withDates);
  }, []);
  useEffect(() => { if (appliedQuery.startDate && appliedQuery.endDate) setBaseSections(buildWorkSections(appliedQuery.startDate, appliedQuery.endDate)); }, [appliedQuery.startDate, appliedQuery.endDate]);

  const sections = useMemo(() => {
    const q = appliedQuery;
    return baseSections.filter((section) => q.category === "all" || section.key === q.category).map((section) => ({
      ...section,
      rows: [...section.rows].sort((left, right) => {
        const first = compareBy(left, right, q.sortKey1) * (q.sortDirection1 === "asc" ? 1 : -1);
        if (first) return first;
        const second = q.sortKey2 ? compareBy(left, right, q.sortKey2) * (q.sortDirection2 === "asc" ? 1 : -1) : 0;
        return second || left.animalNo.localeCompare(right.animalNo, "ko", { numeric: true });
      }),
    }));
  }, [appliedQuery, baseSections]);
  const total = sections.reduce((sum, section) => sum + section.rows.length, 0);
  const current = Math.min(activeIndex, Math.max(0, sections.length - 1));

  function update<K extends keyof Query>(key: K, value: Query[K]) { setDraftQuery((query) => ({ ...query, [key]: value })); }
  function applyQuery() {
    if (!draftQuery.startDate || !draftQuery.endDate) { setMessage("조회기간을 선택하세요."); return; }
    if (draftQuery.startDate > draftQuery.endDate) { setMessage("조회기간 시작일이 종료일보다 늦습니다."); return; }
    setAppliedQuery(draftQuery); setActiveIndex(0); setMessage("");
  }

  async function downloadExcel() {
    setExporting(true); setMessage("");
    try {
      const response = await fetch("/api/reports/scheduled-work/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sections, query: appliedQuery, farmName: "참든팜" }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `작업예정돈_${appliedQuery.startDate}_${appliedQuery.endDate}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const sortText = [`${workSortLabels[appliedQuery.sortKey1]} ${appliedQuery.sortDirection1 === "asc" ? "오름차순" : "내림차순"}`, appliedQuery.sortKey2 ? `${workSortLabels[appliedQuery.sortKey2]} ${appliedQuery.sortDirection2 === "asc" ? "오름차순" : "내림차순"}` : ""].filter(Boolean).join(", ");
  const cell = (column: WorkColumn, row: WorkRow) => { if (column.type === "blank") return ""; const value = row.values[column.key]; return value === null || value === undefined || value === "" ? "" : String(value); };
  const blankCell = { minWidth: 70, borderLeft: "1px solid #e3ebe7" };

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 작업지시서</p><h1>작업예정돈</h1><span>조회기간 동안 교배·임신진단·분만·이유 작업이 예정된 모돈을 찾고, 빈 칸에 작업 결과를 적을 수 있는 작업지로 출력합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>작업예정돈 보고서</h2><p>종류, 조회기간과 정렬기준을 선택하세요. 경과일수는 조회기간 종료일 기준입니다.</p></div></div><span className={styles.newBadge}>생산 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>종류</span><select value={draftQuery.category} onChange={(event) => update("category", event.target.value as Query["category"])}><option value="all">전체</option>{CATEGORY_ORDER.map((key) => <option key={key} value={key}>{workCategoryLabels[key]}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>조회기간 시작</span><input type="date" value={draftQuery.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>조회기간 종료</span><input type="date" value={draftQuery.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬</span><div style={{ display: "flex", gap: 8 }}><select value={draftQuery.sortKey1} onChange={(event) => update("sortKey1", event.target.value as WorkSortKey)}>{Object.entries(workSortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={draftQuery.sortDirection1} onChange={(event) => update("sortDirection1", event.target.value as SortDirection)}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></div></label>
        <div />
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬</span><div style={{ display: "flex", gap: 8 }}><select value={draftQuery.sortKey2} onChange={(event) => update("sortKey2", event.target.value as WorkSortKey | "")}><option value="">- 선택 -</option>{Object.entries(workSortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={draftQuery.sortDirection2} disabled={!draftQuery.sortKey2} onChange={(event) => update("sortDirection2", event.target.value as SortDirection)}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></div></label>
        <div /><div /><div />
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{message ? <p className={styles.exportError}>{message}</p> : null}</div>
    </section>
    {/* 화면에서는 종류를 하나씩 넘겨 보고, 인쇄할 때는 조회된 종류를 모두 출력한다. */}
    <style>{`.work-section-hidden { display: none; } @media print { .work-section-hidden { display: block; } }`}</style>
    <section className={`${styles.listCard} ${styles.printHidden}`} style={{ padding: "14px 20px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
        <strong>조회기간 {appliedQuery.startDate} ~ {appliedQuery.endDate} · 정렬 {sortText} · 합계 {total}두</strong>
        {sections.length > 1 ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className={styles.filterButton} aria-label="이전 종류" disabled={current === 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}><ChevronLeft size={16} /></button>
          <span style={{ minWidth: 48, textAlign: "center", fontWeight: 700 }}>{current + 1} / {sections.length}</span>
          <button type="button" className={styles.filterButton} aria-label="다음 종류" disabled={current === sections.length - 1} onClick={() => setActiveIndex((index) => Math.min(sections.length - 1, index + 1))}><ChevronRight size={16} /></button>
        </div> : null}
      </div>
      {sections.length > 1 ? <nav aria-label="작업예정돈 종류" className={styles.breedingTabs} style={{ marginTop: 12, marginBottom: 0, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>{sections.map((section, index) => <button key={section.key} type="button" className={index === current ? styles.activeBreedingTab : undefined} aria-pressed={index === current} onClick={() => setActiveIndex(index)}>{workCategoryLabels[section.key]}<span style={{ marginLeft: 6, fontWeight: 800 }}>{section.rows.length}</span></button>)}</nav> : null}
    </section>
    {sections.map((section, index) => <Fragment key={section.key}><section className={`${styles.listCard} ${index === current ? "" : "work-section-hidden"}`} style={{ breakBefore: index === 0 ? "auto" : "page", marginTop: 16 }}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>{section.title}</h1><p>조회기간 {appliedQuery.startDate} ~ {appliedQuery.endDate} · 정렬 {sortText}</p></div>
      <div className={styles.listHead}><div><h2>{section.title}</h2><p>&lt; {section.criteria} &gt;</p></div><strong>조회 {section.rows.length}두</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr><th>번호</th><th>모돈번호</th>{section.columns.map((column) => <th key={column.key} style={{ textAlign: "center", ...(column.type === "blank" ? blankCell : {}) }}>{column.label}</th>)}</tr></thead>
        <tbody>{section.rows.length ? section.rows.map((row, rowIndex) => <tr key={row.id}><td>{rowIndex + 1}</td><td><strong>{row.animalNo}</strong></td>{section.columns.map((column) => <td key={column.key} style={{ textAlign: "center", ...(column.type === "blank" ? blankCell : {}) }} className={column.type === "date" ? styles.cycleDate : undefined}>{cell(column, row)}</td>)}</tr>) : <tr><td className={styles.emptyTable} colSpan={section.columns.length + 2}>해당하는 모돈이 없습니다.</td></tr>}</tbody></table></div>
    </section></Fragment>)}
  </ReportShell>;
}
