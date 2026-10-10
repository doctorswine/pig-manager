"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readStoredCullRecords } from "../../production/sows/_data/cull-records";
import { readStoredFarrowingRecords } from "../../production/sows/_data/farrowing-records";
import { readStoredIntakeRecords } from "../../production/sows/_data/intake-records";
import { readStoredMatingRecords } from "../../production/sows/_data/mating-records";
import { readStoredPregnancyIncidentRecords } from "../../production/sows/_data/pregnancy-incident-records";
import { readStoredWeaningRecords } from "../../production/sows/_data/weaning-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

export type FarrowingDueReportType = "basic" | "with-incidents";
export type FarrowingDueSortKey = "animalNo" | "parity" | "dueDate";
type SortDirection = "asc" | "desc";
type PeriodUnit = "day" | "week" | "month";
type Query = {
  reportType: FarrowingDueReportType; unitCount: string; unit: PeriodUnit; startDate: string; endDate: string; minPregnancyDays: string;
  sortKey1: FarrowingDueSortKey; sortDirection1: SortDirection; sortKey2: FarrowingDueSortKey | ""; sortDirection2: SortDirection;
};
export type FarrowingDueRow = {
  id: number; dueDate: string; weekday: string; animalNo: string; earTag: string; breed: string; parity: number; matingSequence: number; parityLabel: string;
  firstMatingDays: number | null; returnDays: number | null; matingDate: string; pregnancyDays: number;
  avgTotalBorn: number | null; avgLiveBorn: number | null; avgWeaned: number | null; incidentCount: number; note: string;
};

export const farrowingDueReportLabels: Record<FarrowingDueReportType, string> = { basic: "분만 예정돈(기본)", "with-incidents": "분만 예정돈대장(사고포함)" };
export const farrowingDueSortLabels: Record<FarrowingDueSortKey, string> = { animalNo: "모돈번호", parity: "산차", dueDate: "예정일" };
const unitLabels: Record<PeriodUnit, string> = { day: "일", week: "주", month: "월" };
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 교배 당일을 1일차로 포함하므로 115일차 분만예정일은 교배일 + 114일이다.
const EXPECTED_FARROWING_DAY = 115;

function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function addDays(text: string, days: number) { const date = new Date(`${text}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function addMonths(text: string, months: number) { const date = new Date(`${text}T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + months); return date.toISOString().slice(0, 10); }
function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); }
function weekdayOf(text: string) { return WEEKDAYS[new Date(`${text}T00:00:00Z`).getUTCDay()]; }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function average(values: number[]) { return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null; }
function periodEnd(start: string, count: string, unit: PeriodUnit) {
  const n = Math.max(1, Math.floor(num(count)) || 1);
  if (!start) return "";
  if (unit === "day") return addDays(start, n - 1);
  if (unit === "week") return addDays(start, n * 7 - 1);
  return addDays(addMonths(start, n), -1);
}
export function farrowingDueSummary(rows: FarrowingDueRow[]) {
  const avg = (values: Array<number | null>) => { const list = values.filter((value): value is number => value !== null); return list.length ? Math.round(list.reduce((sum, value) => sum + value, 0) / list.length) : null; };
  const avg1 = (values: Array<number | null>) => average(values.filter((value): value is number => value !== null));
  return {
    count: rows.length,
    firstMatingDays: avg(rows.map((row) => row.firstMatingDays)),
    returnDays: avg(rows.map((row) => row.returnDays)),
    avgTotalBorn: avg1(rows.map((row) => row.avgTotalBorn)),
    avgLiveBorn: avg1(rows.map((row) => row.avgLiveBorn)),
    avgWeaned: avg1(rows.map((row) => row.avgWeaned)),
    incidentCount: rows.reduce((sum, row) => sum + row.incidentCount, 0),
  };
}

const INITIAL_QUERY: Query = { reportType: "basic", unitCount: "1", unit: "week", startDate: "", endDate: "", minPregnancyDays: "", sortKey1: "dueDate", sortDirection1: "asc", sortKey2: "", sortDirection2: "asc" };

function compareBy(left: FarrowingDueRow, right: FarrowingDueRow, key: FarrowingDueSortKey) {
  if (key === "parity") return left.parity - right.parity || left.matingSequence - right.matingSequence;
  if (key === "dueDate") return left.dueDate.localeCompare(right.dueDate);
  return left.animalNo.localeCompare(right.animalNo, "ko", { numeric: true });
}

export default function FarrowingDueReportPage() {
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [today, setToday] = useState("");
  const [allRows, setAllRows] = useState<FarrowingDueRow[]>([]);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  // 날짜 기본값은 화면이 열린 뒤 브라우저 날짜로 채운다(빌드 시점 날짜와 달라 생기는 렌더링 불일치 방지).
  useEffect(() => {
    const current = localToday();
    setToday(current);
    const withDates = (query: Query) => ({ ...query, startDate: current, endDate: periodEnd(current, query.unitCount, query.unit) });
    setDraftQuery(withDates); setAppliedQuery(withDates);
  }, []);

  useEffect(() => {
    if (!today) return;
    const intakes = readStoredIntakeRecords();
    const culls = readStoredCullRecords();
    const matings = readStoredMatingRecords();
    const incidents = readStoredPregnancyIncidentRecords();
    const farrowings = readStoredFarrowingRecords();
    const weanings = readStoredWeaningRecords();
    const reportType = appliedQuery.reportType;

    const result: FarrowingDueRow[] = [];
    matings.forEach((mating) => {
      const animalNo = mating.animalNo;
      const intake = intakes.find((record) => record.animalNo === animalNo);
      const parity = num(mating.parity);
      const nextMating = matings.filter((record) => record.animalNo === animalNo && record.id !== mating.id && (record.matingDate > mating.matingDate || (record.matingDate === mating.matingDate && record.id > mating.id))).sort((left, right) => left.matingDate.localeCompare(right.matingDate))[0];
      const laterMating = Boolean(nextMating);
      // 이 교배의 결과는 다음 교배 전까지의 임신사고·분만·도폐사 기록으로 판단한다.
      const inWindow = (date: string) => date >= mating.matingDate && (!nextMating || date <= nextMating.matingDate);
      const incidentAfter = incidents.filter((record) => record.animalNo === animalNo && inWindow(record.incidentDate)).sort((left, right) => left.incidentDate.localeCompare(right.incidentDate))[0];
      const farrowingAfter = farrowings.filter((record) => record.animalNo === animalNo && inWindow(record.farrowingDate)).sort((left, right) => left.farrowingDate.localeCompare(right.farrowingDate))[0];
      const cull = culls.find((record) => record.animalNo === animalNo && record.eventDate >= mating.matingDate && (!nextMating || record.eventDate <= nextMating.matingDate));

      const notes: string[] = [];
      if (incidentAfter) notes.push(`임신사고(${incidentAfter.cause}) ${incidentAfter.incidentDate}`);
      if (farrowingAfter) notes.push(`분만 ${farrowingAfter.farrowingDate}`);
      if (cull) notes.push(`${cull.type} ${cull.eventDate}`);
      // 기본: 마지막 교배 이후 임신사고·분만·도폐사가 없는 임신 중 모돈만. 사고포함: 해당 교배를 모두 표시하고 이후 결과를 비고에 적는다.
      if (reportType === "basic" && (laterMating || notes.length)) return;
      if (reportType === "with-incidents" && laterMating && !incidentAfter) return;

      const dueDate = addDays(mating.matingDate, EXPECTED_FARROWING_DAY - 1);
      const sameParityMatings = matings.filter((record) => record.animalNo === animalNo && num(record.parity) === parity && (record.matingDate < mating.matingDate || (record.matingDate === mating.matingDate && record.id <= mating.id)));
      const matingSequence = sameParityMatings.length;
      const previousWeaning = weanings.filter((record) => record.animalNo === animalNo && record.weaningDate <= mating.matingDate).sort((left, right) => right.weaningDate.localeCompare(left.weaningDate))[0];
      const birthDate = intake?.birthDate || "";
      const ownFarrowings = farrowings.filter((record) => record.animalNo === animalNo && record.farrowingDate <= today);
      const ownWeanings = weanings.filter((record) => record.animalNo === animalNo && record.weaningDate <= today);

      result.push({
        id: mating.id, dueDate, weekday: weekdayOf(dueDate), animalNo, earTag: mating.earTag || intake?.earTag || "", breed: mating.breed || intake?.breed || "",
        parity, matingSequence, parityLabel: `${parity}-${matingSequence}`,
        firstMatingDays: parity <= 0 && birthDate ? daysBetween(birthDate, mating.matingDate) : null,
        returnDays: parity > 0 && previousWeaning ? daysBetween(previousWeaning.weaningDate, mating.matingDate) : null,
        matingDate: mating.matingDate, pregnancyDays: daysBetween(mating.matingDate, today) + 1,
        avgTotalBorn: average(ownFarrowings.map((record) => num(record.totalBorn))),
        avgLiveBorn: average(ownFarrowings.map((record) => num(record.liveFemale) + num(record.liveMale))),
        avgWeaned: average(ownWeanings.map((record) => num(record.femaleCount) + num(record.maleCount))),
        incidentCount: incidents.filter((record) => record.animalNo === animalNo && record.incidentDate <= today).length,
        note: notes.join(" · "),
      });
    });
    setAllRows(result);
  }, [appliedQuery.reportType, today]);

  const rows = useMemo(() => {
    const q = appliedQuery;
    const minDays = q.minPregnancyDays.trim() === "" ? null : num(q.minPregnancyDays);
    return allRows
      .filter((row) => row.dueDate >= q.startDate && row.dueDate <= q.endDate)
      // 수태모돈기준일: 입력하면 교배 후 그 일수 이상 지난(임신일수 기준) 모돈만 표시한다.
      .filter((row) => minDays === null || row.pregnancyDays >= minDays)
      .sort((left, right) => {
        const first = compareBy(left, right, q.sortKey1) * (q.sortDirection1 === "asc" ? 1 : -1);
        if (first) return first;
        const second = q.sortKey2 ? compareBy(left, right, q.sortKey2) * (q.sortDirection2 === "asc" ? 1 : -1) : 0;
        return second || left.animalNo.localeCompare(right.animalNo, "ko", { numeric: true });
      });
  }, [allRows, appliedQuery]);
  const summary = useMemo(() => farrowingDueSummary(rows), [rows]);

  function update<K extends keyof Query>(key: K, value: Query[K]) {
    setDraftQuery((query) => {
      const next = { ...query, [key]: value };
      if (key === "startDate" || key === "unitCount" || key === "unit") next.endDate = periodEnd(next.startDate, next.unitCount, next.unit);
      return next;
    });
  }
  function applyQuery() {
    if (!draftQuery.startDate || !draftQuery.endDate) { setMessage("예정일 기간을 선택하세요."); return; }
    if (draftQuery.startDate > draftQuery.endDate) { setMessage("예정일 시작일이 종료일보다 늦습니다."); return; }
    setAppliedQuery(draftQuery); setMessage("");
  }

  async function downloadExcel() {
    setExporting(true); setMessage("");
    try {
      const response = await fetch("/api/reports/farrowing-due/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: rows, query: appliedQuery, farmName: "참든팜" }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `분만예정돈_${appliedQuery.startDate}_${appliedQuery.endDate}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const sortText = [`${farrowingDueSortLabels[appliedQuery.sortKey1]} ${appliedQuery.sortDirection1 === "asc" ? "오름차순" : "내림차순"}`, appliedQuery.sortKey2 ? `${farrowingDueSortLabels[appliedQuery.sortKey2]} ${appliedQuery.sortDirection2 === "asc" ? "오름차순" : "내림차순"}` : ""].filter(Boolean).join(", ");
  const showNote = appliedQuery.reportType === "with-incidents";
  const fmt = (value: number | null) => value === null ? "" : String(value);
  const left = { textAlign: "left" as const };
  const center = { textAlign: "center" as const };

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 작업지시서</p><h1>분만 예정돈</h1><span>교배일을 1일차로 계산한 115일째 분만예정일이 기간 안에 드는 모돈을 조회합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>분만 예정돈대장</h2><p>보고서 구분, 예정일 기간, 수태모돈기준일과 정렬을 선택하세요.</p></div></div><span className={styles.newBadge}>생산 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>보고서 구분</span><select value={draftQuery.reportType} onChange={(event) => update("reportType", event.target.value as FarrowingDueReportType)}>{Object.entries(farrowingDueReportLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>기간 단위</span><div style={{ display: "flex", gap: 8 }}><select value={draftQuery.unitCount} onChange={(event) => update("unitCount", event.target.value)}>{Array.from({ length: 12 }, (_, index) => String(index + 1)).map((value) => <option key={value} value={value}>{value.padStart(2, "0")}</option>)}</select><select value={draftQuery.unit} onChange={(event) => update("unit", event.target.value as PeriodUnit)}>{Object.entries(unitLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></label>
        <label className={styles.field}><span className={styles.fieldLabel}>예정일 시작</span><input type="date" value={draftQuery.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>예정일 종료</span><input type="date" value={draftQuery.endDate} onChange={(event) => setDraftQuery((query) => ({ ...query, endDate: event.target.value }))} /></label>
        <div />
        <label className={styles.field}><span className={styles.fieldLabel}>수태모돈기준일</span><div style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="number" min={0} value={draftQuery.minPregnancyDays} placeholder="입력 시 임신일수 기준" onChange={(event) => update("minPregnancyDays", event.target.value)} /><span style={{ fontSize: 13, color: "#52635d" }}>일</span></div></label>
        <label className={styles.field}><span className={styles.fieldLabel}>1차 정렬</span><div style={{ display: "flex", gap: 8 }}><select value={draftQuery.sortKey1} onChange={(event) => update("sortKey1", event.target.value as FarrowingDueSortKey)}>{Object.entries(farrowingDueSortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={draftQuery.sortDirection1} onChange={(event) => update("sortDirection1", event.target.value as SortDirection)}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></div></label>
        <label className={styles.field}><span className={styles.fieldLabel}>2차 정렬</span><div style={{ display: "flex", gap: 8 }}><select value={draftQuery.sortKey2} onChange={(event) => update("sortKey2", event.target.value as FarrowingDueSortKey | "")}><option value="">- 선택 -</option>{Object.entries(farrowingDueSortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={draftQuery.sortDirection2} disabled={!draftQuery.sortKey2} onChange={(event) => update("sortDirection2", event.target.value as SortDirection)}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></div></label>
        <div />
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{message ? <p className={styles.exportError}>{message}</p> : null}</div>
    </section>
    <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>{farrowingDueReportLabels[appliedQuery.reportType]}</h1><p>산출기준 {appliedQuery.startDate} ~ {appliedQuery.endDate} · 정렬 {sortText}</p></div>
      <div className={styles.listHead}><div><h2>{farrowingDueReportLabels[appliedQuery.reportType]}</h2><p>산출기준 {appliedQuery.startDate} ~ {appliedQuery.endDate} · 정렬 {sortText}{appliedQuery.minPregnancyDays ? ` · 수태모돈기준일 ${appliedQuery.minPregnancyDays}일` : ""}</p></div><strong>조회 {rows.length}두</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr>
        <th>번호</th><th colSpan={2}>분만예정일</th><th>모돈번호</th><th>이각번호</th><th>품종</th><th>산차</th><th>초교배</th><th>재귀일</th><th>교배일</th><th style={center}>평균<br />총산</th><th style={center}>평균<br />실산</th><th>평균<br />이유</th><th>사고<br />횟수</th>{showNote ? <th style={left}>비고</th> : null}
      </tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row.id}>
        <td>{index + 1}</td><td className={styles.cycleDate}>{row.dueDate}</td><td>{row.weekday}</td><td><strong>{row.animalNo}</strong></td><td>{row.earTag}</td><td>{row.breed}</td><td>{row.parityLabel}</td>
        <td>{fmt(row.firstMatingDays)}</td><td>{fmt(row.returnDays)}</td><td style={center}>{row.matingDate}</td><td style={center}>{fmt(row.avgTotalBorn)}</td><td>{fmt(row.avgLiveBorn)}</td><td>{fmt(row.avgWeaned)}</td><td>{row.incidentCount}</td>{showNote ? <td style={left}>{row.note}</td> : null}
      </tr>) : <tr><td className={styles.emptyTable} colSpan={showNote ? 15 : 14}>조회조건에 해당하는 분만 예정돈이 없습니다.</td></tr>}</tbody>
      {rows.length ? <tfoot><tr style={{ background: "#eef4f1", fontWeight: 700 }}><td colSpan={3}>합계</td><td colSpan={3}>{summary.count}두</td><td /><td>{fmt(summary.firstMatingDays)}</td><td>{fmt(summary.returnDays)}</td><td /><td style={center}>{fmt(summary.avgTotalBorn)}</td><td>{fmt(summary.avgLiveBorn)}</td><td>{fmt(summary.avgWeaned)}</td><td style={center}>{summary.incidentCount}</td>{showNote ? <td /> : null}</tr></tfoot> : null}
      </table></div>
      <p className={styles.printHidden} style={{ margin: "10px 18px 16px", fontSize: 12, color: "#6c7c76" }}>산차는 &quot;산차-교배차수&quot;입니다. 초교배는 후보돈의 출생일부터 교배일까지, 재귀일은 경산돈의 최근 이유일부터 교배일까지 일수입니다. 합계 행의 초교배·재귀일·평균 성적은 평균, 사고횟수는 합계입니다.</p>
    </section>
  </ReportShell>;
}
