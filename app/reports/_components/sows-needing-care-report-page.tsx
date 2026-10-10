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

export type CareCategory = "first-estrus" | "unmated-gilt" | "farrowing-delay" | "weaning-delay" | "unmated-weaned" | "unmated-incident";
export type CareSortKey = "overdueDays" | "animalNo" | "parity" | "breed";
type SortDirection = "asc" | "desc";
type Query = { category: "all" | CareCategory; baseDate: string; sortKey1: CareSortKey; sortDirection1: SortDirection; sortKey2: CareSortKey | ""; sortDirection2: SortDirection };
export type CareColumn = { key: string; label: string; type?: "date" | "number" | "text" };
export type CareRow = { id: string; animalNo: string; breed: string; parity: number; matingSequence: number; parityLabel: string; overdueDays: number; values: Record<string, string | number | null> };
export type CareSection = { key: CareCategory; title: string; criteria: string; columns: CareColumn[]; rows: CareRow[] };

// 관리 기준일수(피그지오 관리대상모돈 보고서 기준)
const FIRST_ESTRUS_CHECK_DAYS = 180;
const GILT_MATING_DAYS = 240;
const EXPECTED_FARROWING_DAY = 115; // 교배일을 1일차로 계산한 115일째(교배일 + 114일)
const WEANING_DAYS = 21;
const REMATING_DAYS = 5;

export const careCategoryLabels: Record<CareCategory, string> = {
  "first-estrus": "초발정 후보돈", "unmated-gilt": "미교배 후보돈", "farrowing-delay": "교배후 분만지연돈",
  "weaning-delay": "분만후 이유지연돈", "unmated-weaned": "이유후 미교배돈", "unmated-incident": "사고후 미교배돈",
};
const sectionTitles: Record<CareCategory, string> = {
  "first-estrus": "초발정체크 후보돈", "unmated-gilt": "미교배 후보돈", "farrowing-delay": "교배후 분만지연돈",
  "weaning-delay": "분만후 이유지연돈", "unmated-weaned": "이유후 미교배돈", "unmated-incident": "사고후 미교배돈",
};
export const careSortLabels: Record<CareSortKey, string> = { overdueDays: "초과일수", animalNo: "모돈번호", parity: "산차", breed: "품종" };
const CATEGORY_ORDER = Object.keys(careCategoryLabels) as CareCategory[];

const columnsByCategory: Record<CareCategory, CareColumn[]> = {
  "first-estrus": [{ key: "birthDate", label: "출생일", type: "date" }, { key: "intakeDate", label: "전입일", type: "date" }, { key: "dueDate", label: "초발정체크일", type: "date" }, { key: "elapsed", label: "출생후경과일수", type: "number" }, { key: "overdue", label: "초과일수", type: "number" }],
  "unmated-gilt": [{ key: "birthDate", label: "출생일", type: "date" }, { key: "intakeDate", label: "전입일", type: "date" }, { key: "dueDate", label: "교배예정일", type: "date" }, { key: "elapsed", label: "출생후경과일수", type: "number" }, { key: "overdue", label: "초과일수", type: "number" }],
  "farrowing-delay": [{ key: "parityLabel", label: "산차" }, { key: "matingDate", label: "교배일", type: "date" }, { key: "dueDate", label: "분만예정일", type: "date" }, { key: "elapsed", label: "교배후경과일수", type: "number" }, { key: "overdue", label: "초과일수", type: "number" }],
  "weaning-delay": [{ key: "parityLabel", label: "산차" }, { key: "farrowingDate", label: "분만일", type: "date" }, { key: "dueDate", label: "이유예정일", type: "date" }, { key: "elapsed", label: "분만후경과일수", type: "number" }, { key: "overdue", label: "초과일수", type: "number" }],
  "unmated-weaned": [{ key: "parityLabel", label: "산차" }, { key: "weaningDate", label: "이유일", type: "date" }, { key: "nursingDays", label: "포유일수", type: "number" }, { key: "dueDate", label: "교배예정일", type: "date" }, { key: "elapsed", label: "이유후경과일수", type: "number" }, { key: "overdue", label: "초과일수", type: "number" }],
  "unmated-incident": [{ key: "parityLabel", label: "산차" }, { key: "matingDate", label: "교배일", type: "date" }, { key: "incidentDate", label: "사고일", type: "date" }, { key: "incidentDays", label: "사고일수", type: "number" }, { key: "cause", label: "임신사고원인" }, { key: "elapsed", label: "사고후경과일수", type: "number" }],
};
const criteriaByCategory: Record<CareCategory, string> = {
  "first-estrus": `출생 후 ${FIRST_ESTRUS_CHECK_DAYS} 일 이후`, "unmated-gilt": `출생 후 ${GILT_MATING_DAYS} 일 이후`, "farrowing-delay": `교배 후 ${EXPECTED_FARROWING_DAY} 일 이후`,
  "weaning-delay": `분만 후 ${WEANING_DAYS} 일 이후`, "unmated-weaned": `이유 후 ${REMATING_DAYS} 일 이후`, "unmated-incident": "임신사고 후 재교배하지 않은 모돈",
};

function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function addDays(text: string, days: number) { const date = new Date(`${text}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function isDate(value: string | undefined) { return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)); }

type Event = { date: string; rank: number; kind: "mating" | "incident" | "farrowing" | "weaning"; ref: number };

export function buildCareSections(baseDate: string): CareSection[] {
  const intakes = readStoredIntakeRecords();
  const culls = readStoredCullRecords();
  const estrus = readStoredFirstEstrusRecords();
  const matings = readStoredMatingRecords();
  const incidents = readStoredPregnancyIncidentRecords();
  const farrowings = readStoredFarrowingRecords();
  const weanings = readStoredWeaningRecords();
  const sections: Record<CareCategory, CareRow[]> = { "first-estrus": [], "unmated-gilt": [], "farrowing-delay": [], "weaning-delay": [], "unmated-weaned": [], "unmated-incident": [] };

  intakes.filter((intake) => intake.intakeDate <= baseDate && !culls.some((record) => record.animalNo === intake.animalNo && record.eventDate <= baseDate)).forEach((intake) => {
    const animalNo = intake.animalNo;
    const ownMatings = matings.filter((record) => record.animalNo === animalNo && record.matingDate <= baseDate);
    const events: Event[] = [
      // 같은 날짜에는 분만 → 이유 → 임신사고 → 교배 순서로 일어난 것으로 본다.
      ...farrowings.filter((record) => record.animalNo === animalNo && record.farrowingDate <= baseDate).map((record) => ({ date: record.farrowingDate, rank: 1, kind: "farrowing" as const, ref: record.id })),
      ...weanings.filter((record) => record.animalNo === animalNo && record.weaningDate <= baseDate).map((record) => ({ date: record.weaningDate, rank: 2, kind: "weaning" as const, ref: record.id })),
      ...incidents.filter((record) => record.animalNo === animalNo && record.incidentDate <= baseDate).map((record) => ({ date: record.incidentDate, rank: 3, kind: "incident" as const, ref: record.id })),
      ...ownMatings.map((record) => ({ date: record.matingDate, rank: 4, kind: "mating" as const, ref: record.id })),
    ].sort((left, right) => left.date.localeCompare(right.date) || left.rank - right.rank || left.ref - right.ref);
    const latest = events.at(-1);
    const base = { animalNo, breed: intake.breed || "" };
    const sequenceOf = (parity: number, matingId: number, matingDate: string) => ownMatings.filter((record) => num(record.parity) === parity && (record.matingDate < matingDate || (record.matingDate === matingDate && record.id <= matingId))).length;

    if (!latest) {
      // 교배 기록이 없는 후보돈
      if ((intake.status || "후보돈") !== "후보돈" || !isDate(intake.birthDate)) return;
      const elapsed = daysBetween(intake.birthDate, baseDate);
      const hasEstrus = estrus.some((record) => record.animalNo === animalNo && record.cycles.some((cycle) => isDate(cycle.heatDate) && cycle.heatDate <= baseDate));
      const giltRow = (days: number): CareRow => ({ id: `${animalNo}-${days}`, ...base, parity: 0, matingSequence: 0, parityLabel: "0-0", overdueDays: elapsed - days, values: { birthDate: intake.birthDate, intakeDate: intake.intakeDate, dueDate: addDays(intake.birthDate, days), elapsed, overdue: elapsed - days } });
      if (!hasEstrus && elapsed - FIRST_ESTRUS_CHECK_DAYS >= 1) sections["first-estrus"].push(giltRow(FIRST_ESTRUS_CHECK_DAYS));
      if (elapsed - GILT_MATING_DAYS >= 1) sections["unmated-gilt"].push(giltRow(GILT_MATING_DAYS));
      return;
    }

    if (latest.kind === "mating") {
      const mating = ownMatings.find((record) => record.id === latest.ref)!;
      const parity = num(mating.parity); const sequence = sequenceOf(parity, mating.id, mating.matingDate);
      const dueDate = addDays(mating.matingDate, EXPECTED_FARROWING_DAY - 1);
      const elapsed = daysBetween(mating.matingDate, baseDate) + 1; // 교배일 1일차
      const overdue = elapsed - EXPECTED_FARROWING_DAY;
      if (overdue >= 1) sections["farrowing-delay"].push({ id: `${animalNo}-m${mating.id}`, ...base, breed: mating.breed || base.breed, parity, matingSequence: sequence, parityLabel: `${parity}-${sequence}`, overdueDays: overdue, values: { parityLabel: `${parity}-${sequence}`, matingDate: mating.matingDate, dueDate, elapsed, overdue } });
    } else if (latest.kind === "farrowing") {
      const farrowing = farrowings.find((record) => record.id === latest.ref)!;
      const parity = num(farrowing.parity); const elapsed = daysBetween(farrowing.farrowingDate, baseDate); const overdue = elapsed - WEANING_DAYS;
      if (overdue >= 1) sections["weaning-delay"].push({ id: `${animalNo}-f${farrowing.id}`, ...base, breed: farrowing.breed || base.breed, parity, matingSequence: 0, parityLabel: `${parity}-0`, overdueDays: overdue, values: { parityLabel: `${parity}-0`, farrowingDate: farrowing.farrowingDate, dueDate: addDays(farrowing.farrowingDate, WEANING_DAYS), elapsed, overdue } });
    } else if (latest.kind === "weaning") {
      const weaning = weanings.find((record) => record.id === latest.ref)!;
      const parity = num(weaning.parity); const elapsed = daysBetween(weaning.weaningDate, baseDate); const overdue = elapsed - REMATING_DAYS;
      const nursingDays = weaning.weaningAge ? num(weaning.weaningAge) : isDate(weaning.farrowingDate) ? daysBetween(weaning.farrowingDate, weaning.weaningDate) : null;
      if (overdue >= 1) sections["unmated-weaned"].push({ id: `${animalNo}-w${weaning.id}`, ...base, parity, matingSequence: 0, parityLabel: `${parity}-0`, overdueDays: overdue, values: { parityLabel: `${parity}-0`, weaningDate: weaning.weaningDate, nursingDays, dueDate: addDays(weaning.weaningDate, REMATING_DAYS), elapsed, overdue } });
    } else {
      const incident = incidents.find((record) => record.id === latest.ref)!;
      const mating = ownMatings.filter((record) => record.matingDate <= incident.incidentDate).sort((left, right) => right.matingDate.localeCompare(left.matingDate) || right.id - left.id)[0];
      const matingDate = mating?.matingDate || incident.matingDate || "";
      const parity = num(mating?.parity ?? incident.parity); const sequence = mating ? sequenceOf(parity, mating.id, mating.matingDate) : 0;
      const elapsed = daysBetween(incident.incidentDate, baseDate);
      // 사고후 미교배돈은 초과일수 대신 사고후 경과일수로 정렬한다.
      sections["unmated-incident"].push({ id: `${animalNo}-i${incident.id}`, ...base, breed: incident.breed || base.breed, parity, matingSequence: sequence, parityLabel: `${parity}-${sequence}`, overdueDays: elapsed, values: { parityLabel: `${parity}-${sequence}`, matingDate, incidentDate: incident.incidentDate, incidentDays: isDate(matingDate) ? daysBetween(matingDate, incident.incidentDate) : null, cause: incident.cause, elapsed } });
    }
  });

  return CATEGORY_ORDER.map((key) => ({ key, title: sectionTitles[key], criteria: criteriaByCategory[key], columns: columnsByCategory[key], rows: sections[key] }));
}

function compareBy(left: CareRow, right: CareRow, key: CareSortKey) {
  if (key === "overdueDays") return left.overdueDays - right.overdueDays;
  if (key === "parity") return left.parity - right.parity || left.matingSequence - right.matingSequence;
  if (key === "breed") return left.breed.localeCompare(right.breed, "ko");
  return left.animalNo.localeCompare(right.animalNo, "ko", { numeric: true });
}

const INITIAL_QUERY: Query = { category: "all", baseDate: "", sortKey1: "overdueDays", sortDirection1: "desc", sortKey2: "", sortDirection2: "asc" };

export default function SowsNeedingCareReportPage() {
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [baseSections, setBaseSections] = useState<CareSection[]>([]);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // 날짜 기본값은 화면이 열린 뒤 브라우저 날짜로 채운다(빌드 시점 날짜와 달라 생기는 렌더링 불일치 방지).
  useEffect(() => { const today = localToday(); setDraftQuery((query) => ({ ...query, baseDate: today })); setAppliedQuery((query) => ({ ...query, baseDate: today })); }, []);
  useEffect(() => { if (appliedQuery.baseDate) setBaseSections(buildCareSections(appliedQuery.baseDate)); }, [appliedQuery.baseDate]);

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
  function applyQuery() { if (!draftQuery.baseDate) { setMessage("조회기준일을 선택하세요."); return; } setAppliedQuery(draftQuery); setActiveIndex(0); setMessage(""); }

  async function downloadExcel() {
    setExporting(true); setMessage("");
    try {
      const response = await fetch("/api/reports/sows-needing-care/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sections, query: appliedQuery, farmName: "참든팜" }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `관리대상모돈_${appliedQuery.baseDate}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const sortText = [`${careSortLabels[appliedQuery.sortKey1]} ${appliedQuery.sortDirection1 === "asc" ? "오름차순" : "내림차순"}`, appliedQuery.sortKey2 ? `${careSortLabels[appliedQuery.sortKey2]} ${appliedQuery.sortDirection2 === "asc" ? "오름차순" : "내림차순"}` : ""].filter(Boolean).join(", ");
  const cell = (column: CareColumn, row: CareRow) => { const value = row.values[column.key]; return value === null || value === undefined || value === "" ? "" : String(value); };

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 작업지시서</p><h1>관리대상모돈</h1><span>조회기준일 현재 초발정·교배·분만·이유·재교배가 기준일수를 넘긴 모돈을 종류별로 찾습니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>관리대상모돈 보고서</h2><p>종류, 조회기준일과 정렬기준을 선택하세요. 사고후 미교배돈은 초과일수 대신 사고후 경과일수로 정렬합니다.</p></div></div><span className={styles.newBadge}>생산 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>종류</span><select value={draftQuery.category} onChange={(event) => update("category", event.target.value as Query["category"])}><option value="all">전체</option>{CATEGORY_ORDER.map((key) => <option key={key} value={key}>{careCategoryLabels[key]}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>조회기준일</span><input type="date" value={draftQuery.baseDate} onChange={(event) => update("baseDate", event.target.value)} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬</span><div style={{ display: "flex", gap: 8 }}><select value={draftQuery.sortKey1} onChange={(event) => update("sortKey1", event.target.value as CareSortKey)}>{Object.entries(careSortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={draftQuery.sortDirection1} onChange={(event) => update("sortDirection1", event.target.value as SortDirection)}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></div></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬</span><div style={{ display: "flex", gap: 8 }}><select value={draftQuery.sortKey2} onChange={(event) => update("sortKey2", event.target.value as CareSortKey | "")}><option value="">- 선택 -</option>{Object.entries(careSortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={draftQuery.sortDirection2} disabled={!draftQuery.sortKey2} onChange={(event) => update("sortDirection2", event.target.value as SortDirection)}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></div></label>
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{message ? <p className={styles.exportError}>{message}</p> : null}</div>
    </section>
    {/* 화면에서는 종류를 하나씩 넘겨 보고, 인쇄할 때는 조회된 종류를 모두 출력한다. */}
    <style>{`.care-section-hidden { display: none; } @media print { .care-section-hidden { display: block; } }`}</style>
    <section className={`${styles.listCard} ${styles.printHidden}`} style={{ padding: "14px 20px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
        <strong>조회기준일 {appliedQuery.baseDate} · 정렬 {sortText} · 합계 {total}두</strong>
        {sections.length > 1 ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className={styles.filterButton} aria-label="이전 종류" disabled={current === 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}><ChevronLeft size={16} /></button>
          <span style={{ minWidth: 48, textAlign: "center", fontWeight: 700 }}>{current + 1} / {sections.length}</span>
          <button type="button" className={styles.filterButton} aria-label="다음 종류" disabled={current === sections.length - 1} onClick={() => setActiveIndex((index) => Math.min(sections.length - 1, index + 1))}><ChevronRight size={16} /></button>
        </div> : null}
      </div>
      {sections.length > 1 ? <nav aria-label="관리대상모돈 종류" className={styles.breedingTabs} style={{ marginTop: 12, marginBottom: 0, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>{sections.map((section, index) => <button key={section.key} type="button" className={index === current ? styles.activeBreedingTab : undefined} aria-pressed={index === current} onClick={() => setActiveIndex(index)}>{careCategoryLabels[section.key]}<span style={{ marginLeft: 6, fontWeight: 800 }}>{section.rows.length}</span></button>)}</nav> : null}
    </section>
    {sections.map((section, index) => <Fragment key={section.key}><section className={`${styles.listCard} ${index === current ? "" : "care-section-hidden"}`} style={{ breakBefore: index === 0 ? "auto" : "page", marginTop: 16 }}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>{section.title}</h1><p>조회기준일 {appliedQuery.baseDate} · 정렬 {sortText} · &lt; {section.criteria} &gt;</p></div>
      <div className={styles.listHead}><div><h2>{section.title}</h2><p>&lt; {section.criteria} &gt;</p></div><strong>조회 {section.rows.length}두</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr><th>번호</th><th>모돈번호</th><th>품종</th>{section.columns.map((column) => <th key={column.key} style={{ textAlign: "center" }}>{column.label}</th>)}</tr></thead>
        <tbody>{section.rows.length ? section.rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><strong>{row.animalNo}</strong></td><td>{row.breed}</td>{section.columns.map((column) => <td key={column.key} style={{ textAlign: "center" }} className={column.type === "date" ? styles.cycleDate : undefined}>{cell(column, row)}</td>)}</tr>) : <tr><td className={styles.emptyTable} colSpan={section.columns.length + 3}>해당하는 모돈이 없습니다.</td></tr>}</tbody></table></div>
    </section></Fragment>)}
  </ReportShell>;
}
