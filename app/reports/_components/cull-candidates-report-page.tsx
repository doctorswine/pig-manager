"use client";

import { Download, FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readStoredCullRecords } from "../../production/sows/_data/cull-records";
import { readStoredFarrowingRecords } from "../../production/sows/_data/farrowing-records";
import { readStoredIntakeRecords } from "../../production/sows/_data/intake-records";
import { readStoredMatingRecords } from "../../production/sows/_data/mating-records";
import { readStoredNursingPigletRecords } from "../../production/sows/_data/nursing-piglet-records";
import { readStoredPregnancyIncidentRecords } from "../../production/sows/_data/pregnancy-incident-records";
import { readStoredWeaningRecords } from "../../production/sows/_data/weaning-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

export type CullCandidateSortKey = "elapsedDays" | "animalNo" | "parity" | "currentCull" | "totalCull" | "avgTotalBorn" | "avgLiveBorn" | "dystocia" | "incidentCount" | "avgWeaned" | "recentTotalBorn" | "recentLiveBorn" | "recentWeaned" | "bcs" | "currentStatus" | "lastWorkDate";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "후보돈" | "임신돈" | "포유돈" | "이유모돈" | "대리모돈" | "사고돈";
type Query = {
  startDate: string; endDate: string; parityFrom: string; parityTo: string;
  maxAvgTotalBorn: string; maxAvgLiveBorn: string; maxAvgWeaned: string; minIncidentCount: string; minDystocia: string;
  status: StatusFilter; sortKey: CullCandidateSortKey; sortDirection: SortDirection;
};
type WorkEvent = { date: string; status: string; parity?: string };
export type CullCandidateRow = {
  id: number; animalNo: string; earTag: string; parity: number;
  currentCull: number | null; totalCull: number | null;
  avgTotalBorn: number | null; avgLiveBorn: number | null; dystocia: number; incidentCount: number; avgWeaned: number | null;
  recentTotalBorn: number | null; recentLiveBorn: number | null; recentWeaned: number | null; bcs: number | null;
  currentStatus: string; lastWorkDate: string; elapsedDays: number | null;
  matched: { avgTotalBorn: boolean; avgLiveBorn: boolean; avgWeaned: boolean; incidentCount: boolean; dystocia: boolean };
};

const STATUS_OPTIONS: Exclude<StatusFilter, "all">[] = ["후보돈", "임신돈", "포유돈", "이유모돈", "대리모돈", "사고돈"];
export const cullCandidateSortLabels: Record<CullCandidateSortKey, string> = {
  elapsedDays: "경과일", animalNo: "모돈번호", parity: "산차", currentCull: "현산차 생시도태", totalCull: "전체산차 생시도태",
  avgTotalBorn: "평균총산", avgLiveBorn: "평균실산", dystocia: "난산/후산", incidentCount: "총사고횟수", avgWeaned: "평균이유",
  recentTotalBorn: "최근총산", recentLiveBorn: "최근실산", recentWeaned: "최근이유", bcs: "BCS", currentStatus: "현재상태", lastWorkDate: "최근작업일",
};

function localToday() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function addDays(text: string, days: number) { const date = new Date(`${text}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function average(values: number[]) { return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null; }
function threshold(value: string) { return value.trim() === "" || !Number.isFinite(Number(value)) ? null : Number(value); }

// 날짜 기본값은 화면이 열린 뒤 브라우저 날짜로 채운다(빌드 시점 날짜와 달라 생기는 렌더링 불일치 방지).
const INITIAL_QUERY: Query = {
  startDate: "", endDate: "", parityFrom: "0", parityTo: "8",
  maxAvgTotalBorn: "8", maxAvgLiveBorn: "8", maxAvgWeaned: "8", minIncidentCount: "0", minDystocia: "0",
  status: "all", sortKey: "elapsedDays", sortDirection: "desc",
};

function compareRows(left: CullCandidateRow, right: CullCandidateRow, key: CullCandidateSortKey, direction: SortDirection) {
  const a = left[key]; const b = right[key];
  // 값이 없는 칸은 정렬 방향과 관계없이 항상 뒤로 보낸다.
  if (a === null || b === null) return a === null && b === null ? 0 : a === null ? 1 : -1;
  const compared = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "ko", { numeric: true });
  return direction === "asc" ? compared : -compared;
}

export function formatCount(value: number | null) { return value === null ? "" : String(value); }

// 피그플랜 도태예정돈 고정 조건(매뉴얼 p.214) — 화면에 참고 예시로만 보여준다.
const PIGPLAN_CULL_EXAMPLES = [
  { title: "3번 이상 임신사고 모돈", detail: "최근 산차에서 임신사고가 3번 이상 난 모돈", howTo: "총사고횟수 3 이상" },
  { title: "7산 이상 · 최근 이유두수 8두 이하", detail: "7산 이상이면서 최근 산차 이유두수가 8두 이하인 모돈", howTo: "산차 7부터 + 평균이유 8 이하" },
  { title: "생후 300일 이상 후보돈", detail: "교배 기록 없이 생후 300일이 지난 후보돈", howTo: "관리대상모돈 > 미교배 후보돈에서 출생후 경과일 확인" },
  { title: "임신말기 불임돈", detail: "교배 후 82일 이상 지나서 임신사고가 난 모돈", howTo: "임신사고 원인분석의 공태·분만사불임(81일 이상) 참고" },
  { title: "최근 3산 총산 합 20두 이하", detail: "최근 3번 분만의 총산자수 합이 20두 이하인 모돈", howTo: "평균총산 6.7 이하(20 ÷ 3)로 비슷하게 확인" },
];

export default function CullCandidatesReportPage() {
  const [draftQuery, setDraftQuery] = useState<Query>(INITIAL_QUERY);
  const [appliedQuery, setAppliedQuery] = useState<Query>(INITIAL_QUERY);
  const [baseRows, setBaseRows] = useState<Omit<CullCandidateRow, "matched">[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    const today = localToday();
    const withDates = (query: Query) => ({ ...query, startDate: addDays(today, -30), endDate: today });
    setDraftQuery(withDates); setAppliedQuery(withDates);
  }, []);

  useEffect(() => {
    const endDate = appliedQuery.endDate;
    if (!endDate) return;
    const intakes = readStoredIntakeRecords();
    const culls = readStoredCullRecords();
    const matings = readStoredMatingRecords();
    const incidents = readStoredPregnancyIncidentRecords();
    const farrowings = readStoredFarrowingRecords();
    const nursing = readStoredNursingPigletRecords();
    const weanings = readStoredWeaningRecords();

    const result = intakes.filter((intake) => intake.intakeDate <= endDate && !culls.some((record) => record.animalNo === intake.animalNo && record.eventDate <= endDate)).map((intake) => {
      const own = <T extends { animalNo: string }>(records: T[], dateOf: (record: T) => string) => records.filter((record) => record.animalNo === intake.animalNo && dateOf(record) <= endDate).sort((left, right) => dateOf(left).localeCompare(dateOf(right)));
      const ownMatings = own(matings, (record) => record.matingDate);
      const ownIncidents = own(incidents, (record) => record.incidentDate);
      const ownFarrowings = own(farrowings, (record) => record.farrowingDate);
      const ownNursing = own(nursing, (record) => record.workDate);
      const ownWeanings = own(weanings, (record) => record.weaningDate);

      const events: WorkEvent[] = [{ date: intake.intakeDate, status: intake.status || "후보돈", parity: intake.parity }];
      ownMatings.forEach((record) => events.push({ date: record.matingDate, status: "임신돈", parity: record.parity }));
      ownIncidents.forEach((record) => events.push({ date: record.incidentDate, status: "사고돈", parity: record.parity }));
      ownFarrowings.forEach((record) => events.push({ date: record.farrowingDate, status: "포유돈", parity: record.parity }));
      ownNursing.forEach((record) => events.push({ date: record.workDate, status: "포유돈", parity: record.parity }));
      ownWeanings.forEach((record) => events.push({ date: record.weaningDate, status: "이유모돈", parity: record.parity }));
      events.sort((left, right) => left.date.localeCompare(right.date));
      const latest = events.at(-1)!;

      const cullOf = (record: (typeof ownFarrowings)[number]) => num(record.cullSmall) + num(record.cullDeformity) + num(record.cullOther);
      const liveOf = (record: (typeof ownFarrowings)[number]) => num(record.liveFemale) + num(record.liveMale);
      const weanedOf = (record: (typeof ownWeanings)[number]) => num(record.femaleCount) + num(record.maleCount);
      const lastFarrowing = ownFarrowings.at(-1);
      const lastWeaning = ownWeanings.at(-1);
      // 경과일: 비생산 상태(이유모돈·사고돈)에서 마지막 이유·사고 후 조회 종료일까지 지난 일수
      const elapsedDays = latest.status === "이유모돈" || latest.status === "사고돈" ? daysBetween(latest.date, endDate) : null;

      return {
        id: intake.id, animalNo: intake.animalNo, earTag: intake.earTag, parity: num(latest.parity || intake.parity),
        currentCull: lastFarrowing ? cullOf(lastFarrowing) : null,
        totalCull: ownFarrowings.length ? ownFarrowings.reduce((sum, record) => sum + cullOf(record), 0) : null,
        avgTotalBorn: average(ownFarrowings.map((record) => num(record.totalBorn))),
        avgLiveBorn: average(ownFarrowings.map(liveOf)),
        dystocia: ownFarrowings.filter((record) => record.farrowingType === "난산").length,
        incidentCount: ownIncidents.length,
        avgWeaned: average(ownWeanings.map(weanedOf)),
        recentTotalBorn: lastFarrowing ? num(lastFarrowing.totalBorn) : null,
        recentLiveBorn: lastFarrowing ? liveOf(lastFarrowing) : null,
        recentWeaned: lastWeaning ? weanedOf(lastWeaning) : null,
        bcs: null,
        currentStatus: latest.status,
        lastWorkDate: latest.date,
        elapsedDays,
      };
    });
    setBaseRows(result);
  }, [appliedQuery.endDate]);

  const rows = useMemo<CullCandidateRow[]>(() => {
    const q = appliedQuery;
    const parityFrom = threshold(q.parityFrom); const parityTo = threshold(q.parityTo);
    const maxTotal = threshold(q.maxAvgTotalBorn); const maxLive = threshold(q.maxAvgLiveBorn); const maxWeaned = threshold(q.maxAvgWeaned);
    const minIncident = threshold(q.minIncidentCount); const minDystocia = threshold(q.minDystocia);
    return baseRows
      .filter((row) => row.lastWorkDate >= q.startDate && row.lastWorkDate <= q.endDate)
      .filter((row) => (parityFrom === null || row.parity >= parityFrom) && (parityTo === null || row.parity <= parityTo))
      .filter((row) => q.status === "all" || row.currentStatus === q.status)
      .map((row) => ({
        ...row,
        matched: {
          avgTotalBorn: maxTotal !== null && row.avgTotalBorn !== null && row.avgTotalBorn <= maxTotal,
          avgLiveBorn: maxLive !== null && row.avgLiveBorn !== null && row.avgLiveBorn <= maxLive,
          avgWeaned: maxWeaned !== null && row.avgWeaned !== null && row.avgWeaned <= maxWeaned,
          incidentCount: minIncident !== null && row.incidentCount >= minIncident,
          dystocia: minDystocia !== null && row.dystocia >= minDystocia,
        },
      }))
      // 산출기준(평균총산·평균실산·평균이유·총사고횟수·난산/후산)은 하나라도 해당하면 대상에 포함한다.
      .filter((row) => Object.values(row.matched).some(Boolean))
      .sort((left, right) => compareRows(left, right, q.sortKey, q.sortDirection) || left.animalNo.localeCompare(right.animalNo, "ko", { numeric: true }));
  }, [appliedQuery, baseRows]);

  function update<K extends keyof Query>(key: K, value: Query[K]) { setDraftQuery((query) => ({ ...query, [key]: value })); }
  function applyQuery() {
    if (draftQuery.startDate > draftQuery.endDate) { setExportError("기간 시작일이 종료일보다 늦습니다."); return; }
    setAppliedQuery(draftQuery); setExportError("");
  }

  async function downloadExcel() {
    setExporting(true); setExportError("");
    try {
      const response = await fetch("/api/reports/cull-candidates/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: rows, query: appliedQuery, farmName: "참든팜" }) });
      if (!response.ok) { const payload = await response.json().catch(() => ({ message: "엑셀 파일을 만들지 못했습니다." })); throw new Error(payload.message || "엑셀 파일을 만들지 못했습니다."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `도태예정돈_${appliedQuery.startDate}_${appliedQuery.endDate}.xlsx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setExportError(error instanceof Error ? error.message : "엑셀 파일을 만들지 못했습니다."); } finally { setExporting(false); }
  }

  const hit = (matched: boolean) => matched ? { background: "#e8243c", color: "#fff", fontWeight: 700 } : undefined;
  const center = { textAlign: "center" as const };
  const numberField = (key: keyof Query, suffix: string, label: string) => <label className={styles.field}><span className={styles.fieldLabel}>{label}</span><div style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="number" min={0} step="0.1" value={draftQuery[key] as string} onChange={(event) => update(key, event.target.value as never)} /><span style={{ whiteSpace: "nowrap", fontSize: 13, color: "#52635d" }}>{suffix}</span></div></label>;

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 작업지시서</p><h1>도태 기준모돈 산출</h1><span>산출기준은 농장에 맞는 수치를 입력해 조회·출력합니다. 산출기준 중 하나라도 해당하는 모돈을 표시합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>도태 기준모돈 산출 보고서</h2><p>기간은 모돈의 최근 작업일 기준입니다. 빈칸으로 둔 산출기준은 적용하지 않습니다.</p></div></div><span className={styles.newBadge}>생산 기록 연결</span></div>
      <div className={styles.formSection}><div className={styles.reportFilterGrid}>
        <label className={styles.field}><span className={styles.fieldLabel}>기간 시작 (최근작업일)</span><input type="date" value={draftQuery.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>기간 종료 (최근작업일)</span><input type="date" value={draftQuery.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>산차 (부터)</span><input type="number" min={0} value={draftQuery.parityFrom} onChange={(event) => update("parityFrom", event.target.value)} /></label>
        <label className={styles.field}><span className={styles.fieldLabel}>산차 (까지)</span><input type="number" min={0} value={draftQuery.parityTo} onChange={(event) => update("parityTo", event.target.value)} /></label>
        <div />
        {numberField("maxAvgTotalBorn", "이하", "평균총산")}
        {numberField("maxAvgLiveBorn", "이하", "평균실산")}
        {numberField("maxAvgWeaned", "이하", "평균이유")}
        {numberField("minIncidentCount", "이상", "총사고횟수")}
        <div />
        {numberField("minDystocia", "이상", "난산/후산")}
        <label className={styles.field}><span className={styles.fieldLabel}>현재상태</span><select value={draftQuery.status} onChange={(event) => update("status", event.target.value as StatusFilter)}><option value="all">전체</option>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>정렬기준</span><select value={draftQuery.sortKey} onChange={(event) => update("sortKey", event.target.value as CullCandidateSortKey)}>{Object.entries(cullCandidateSortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.field}><span className={styles.fieldLabel}>정렬방향</span><select value={draftQuery.sortDirection} onChange={(event) => update("sortDirection", event.target.value as SortDirection)}><option value="desc">내림차순</option><option value="asc">오름차순</option></select></label>
        <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={applyQuery}><Search size={16} />조회</button><button type="button" className={styles.filterButton} onClick={() => window.print()}><Printer size={16} />출력</button><button type="button" className={styles.filterButton} disabled={exporting} onClick={downloadExcel}><Download size={16} />{exporting ? "생성 중..." : "엑셀 다운로드"}</button></div>
      </div>{exportError ? <p className={styles.exportError}>{exportError}</p> : null}</div>
    </section>
    <section className={`${styles.listCard} ${styles.printHidden}`}>
      <div className={styles.listHead}><div><h2>참고 · 피그플랜 도태예정돈 고정 조건 (예시)</h2><p>피그플랜은 아래 5가지 조건으로 도태예정돈을 자동 산출합니다(매뉴얼 p.214, 설정값·기간 없음). 이 화면은 위 산출기준을 농장에 맞게 직접 입력하는 방식이며, 아래는 기준을 정할 때 참고하는 예시입니다.</p></div></div>
      <div className={styles.tableWrap}><table className={styles.reportTable} style={{ minWidth: 0 }}><thead><tr><th style={{ width: 48, textAlign: "center" }}>번호</th><th>피그플랜 조건</th><th>내용</th><th>이 화면에서 비슷하게 보려면 (나머지 산출기준 칸은 비움)</th></tr></thead><tbody>
        {PIGPLAN_CULL_EXAMPLES.map((item, index) => <tr key={item.title}><td style={{ textAlign: "center" }}>{index + 1}</td><td><strong>{item.title}</strong></td><td>{item.detail}</td><td>{item.howTo}</td></tr>)}
      </tbody></table></div>
    </section>
    <section className={styles.listCard}>
      <div className={styles.printReportHead}><strong>참든팜</strong><h1>도태 예정돈</h1><p>최근작업일 {appliedQuery.startDate} ~ {appliedQuery.endDate} · 정렬 {cullCandidateSortLabels[appliedQuery.sortKey]} {appliedQuery.sortDirection === "asc" ? "오름차순" : "내림차순"}</p></div>
      <div className={styles.listHead}><div><h2>도태 예정돈</h2><p>최근작업일 {appliedQuery.startDate} ~ {appliedQuery.endDate} · 산차 {appliedQuery.parityFrom || "-"}~{appliedQuery.parityTo || "-"} · 빨간 칸은 산출기준에 해당하는 값입니다.</p></div><strong>조회 {rows.length}두</strong></div>
      <div className={styles.tableWrap}><table className={styles.reportTable}><thead><tr>
        <th>번호</th><th>개체번호</th><th>산차</th><th>현산차<br />생시도태</th><th>전체산차<br />생시도태</th><th>평균<br />총산</th><th>평균<br />실산</th><th>난산<br />후산</th><th>총 사고<br />횟수</th><th style={center}>평균<br />이유</th><th style={center}>최근<br />총산</th><th>최근<br />실산</th><th>최근<br />이유</th><th>BCS</th><th>현재상태</th><th>최근 작업일</th><th>경과일</th>
      </tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row.id}>
        <td>{index + 1}</td><td><strong>{row.animalNo}</strong></td><td>{row.parity}</td><td>{formatCount(row.currentCull)}</td><td>{formatCount(row.totalCull)}</td>
        <td style={hit(row.matched.avgTotalBorn)}>{formatCount(row.avgTotalBorn)}</td><td style={hit(row.matched.avgLiveBorn)}>{formatCount(row.avgLiveBorn)}</td>
        <td style={hit(row.matched.dystocia && row.dystocia > 0)}>{row.dystocia || ""}</td><td style={hit(row.matched.incidentCount && row.incidentCount > 0)}>{row.incidentCount || ""}</td>
        <td style={{ ...center, ...hit(row.matched.avgWeaned) }}>{formatCount(row.avgWeaned)}</td><td style={center}>{formatCount(row.recentTotalBorn)}</td><td>{formatCount(row.recentLiveBorn)}</td><td>{formatCount(row.recentWeaned)}</td>
        <td>{formatCount(row.bcs)}</td><td><span className={styles.statusBadge}>{row.currentStatus}</span></td><td className={styles.cycleDate}>{row.lastWorkDate}</td><td>{formatCount(row.elapsedDays)}</td>
      </tr>) : <tr><td className={styles.emptyTable} colSpan={17}>조회조건에 해당하는 도태 예정돈이 없습니다.</td></tr>}</tbody></table></div>
    </section>
  </ReportShell>;
}
