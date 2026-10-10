"use client";

import { FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readStoredBackfatRecords } from "../../production/sows/_data/backfat-records";
import { readStoredCullRecords } from "../../production/sows/_data/cull-records";
import { readStoredFarrowingRecords, FarrowingRecord } from "../../production/sows/_data/farrowing-records";
import { readStoredFirstEstrusRecords } from "../../production/sows/_data/first-estrus-records";
import { readStoredIntakeRecords, SowIntakeRecord } from "../../production/sows/_data/intake-records";
import { readStoredMatingRecords, MatingRecord } from "../../production/sows/_data/mating-records";
import { NursingPigletRecord, readStoredNursingPigletRecords } from "../../production/sows/_data/nursing-piglet-records";
import { PregnancyIncidentRecord, readStoredPregnancyIncidentRecords } from "../../production/sows/_data/pregnancy-incident-records";
import { readStoredWeaningRecords, WeaningRecord } from "../../production/sows/_data/weaning-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

type SortKey = "animalNo" | "breed" | "parity" | "birthDate" | "intakeDate" | "currentStatus" | "lastWorkDate";
type SortDirection = "asc" | "desc";
type Query = { status: string; parityFrom: string; parityTo: string; keyword: string; sortKey: SortKey; sortDirection: SortDirection };
type Event = { date: string; category: string; detail: string; status?: string; parity?: string; location?: string };
type Card = SowIntakeRecord & { currentStatus: string; lastWork: string; lastWorkDate: string; events: Event[]; matings: MatingRecord[]; incidents: PregnancyIncidentRecord[]; farrowings: FarrowingRecord[]; nursing: NursingPigletRecord[]; weanings: WeaningRecord[] };
const INITIAL_QUERY: Query = { status: "all", parityFrom: "0", parityTo: "20", keyword: "", sortKey: "animalNo", sortDirection: "asc" };
const sortLabels: Record<SortKey, string> = { animalNo: "모돈번호", breed: "품종", parity: "산차", birthDate: "출생일", intakeDate: "전입일", currentStatus: "현재상태", lastWorkDate: "최종작업일" };
const statuses = ["후보돈", "임신돈", "포유돈", "이유모돈", "재발돈", "사고돈", "도폐사돈"];
const number = (value: string | undefined) => Number(value || 0);
const daysBetween = (from?: string, to?: string) => from && to ? Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000) : 0;

function compare(left: Card, right: Card, key: SortKey) { return key === "parity" ? number(left.parity) - number(right.parity) : String(left[key] ?? "").localeCompare(String(right[key] ?? ""), "ko", { numeric: true }); }

export default function SowCardReportPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [query, setQuery] = useState<Query>(INITIAL_QUERY);
  const [applied, setApplied] = useState<Query>(INITIAL_QUERY);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printCards, setPrintCards] = useState<Card[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const intakes = readStoredIntakeRecords(), estrus = readStoredFirstEstrusRecords(), matings = readStoredMatingRecords(), incidents = readStoredPregnancyIncidentRecords(), farrowings = readStoredFarrowingRecords(), nursing = readStoredNursingPigletRecords(), weanings = readStoredWeaningRecords(), backfat = readStoredBackfatRecords(), culls = readStoredCullRecords();
    setCards(intakes.map((intake) => {
      const events: Event[] = [{ date: intake.intakeDate, category: "전입", detail: `${intake.status} · ${intake.weight || "-"}kg`, status: intake.status, parity: intake.parity }];
      estrus.filter((r) => r.animalNo === intake.animalNo).forEach((r) => r.cycles.forEach((c, i) => { if (c.heatDate) events.push({ date: c.heatDate, category: `${i + 1}차 발정`, detail: `${c.intensity} · 체중 ${c.weight || "-"}kg · 등지방 ${c.backfat || "-"}mm`, status: "후보돈" }); }));
      const sowMatings = matings.filter((r) => r.animalNo === intake.animalNo); sowMatings.forEach((r) => events.push({ date: r.matingDate, category: "교배", detail: [r.boar1, r.boar2, r.boar3].filter(Boolean).join(", ") || "웅돈 미입력", status: "임신돈", parity: r.parity, location: r.location }));
      const sowIncidents = incidents.filter((r) => r.animalNo === intake.animalNo); sowIncidents.forEach((r) => events.push({ date: r.incidentDate, category: "임신사고", detail: `${r.cause}${r.note ? ` · ${r.note}` : ""}`, status: r.cause === "재발" ? "재발돈" : "사고돈", parity: r.parity, location: r.diagnosisLocation }));
      const sowFarrowings = farrowings.filter((r) => r.animalNo === intake.animalNo); sowFarrowings.forEach((r) => events.push({ date: r.farrowingDate, category: "분만", detail: `${r.farrowingType} · 총산 ${r.totalBorn} · 실산 ${number(r.liveFemale) + number(r.liveMale)}`, status: "포유돈", parity: r.parity, location: r.location }));
      const sowNursing = nursing.filter((r) => r.animalNo === intake.animalNo); sowNursing.forEach((r) => events.push({ date: r.workDate, category: r.category, detail: `${number(r.femaleCount) + number(r.maleCount)}두${r.cause ? ` · ${r.cause}` : ""}`, status: "포유돈", parity: r.parity }));
      const sowWeanings = weanings.filter((r) => r.animalNo === intake.animalNo); sowWeanings.forEach((r) => events.push({ date: r.weaningDate, category: "이유", detail: `${number(r.femaleCount) + number(r.maleCount)}두 · ${r.weaningAge}일령`, status: "이유모돈", parity: r.parity, location: r.sowMoveLocation }));
      backfat.filter((r) => r.animalNo === intake.animalNo).forEach((r) => events.push({ date: r.measurementDate, category: "등지방", detail: `${r.measurementTiming} · 체중 ${r.weight || "-"}kg · ${r.backfat}mm`, parity: r.parity }));
      culls.filter((r) => r.animalNo === intake.animalNo).forEach((r) => events.push({ date: r.eventDate, category: r.type, detail: `${r.cause}${r.buyer ? ` · ${r.buyer}` : ""}`, status: "도폐사돈", parity: r.parity }));
      events.sort((a, b) => a.date.localeCompare(b.date)); const latest = events.at(-1)!;
      return { ...intake, parity: latest.parity || intake.parity, currentStatus: latest.status || intake.status, lastWork: latest.category, lastWorkDate: latest.date, events, matings: sowMatings, incidents: sowIncidents, farrowings: sowFarrowings, nursing: sowNursing, weanings: sowWeanings };
    }));
  }, []);

  const rows = useMemo(() => cards.filter((card) => (applied.status === "all" || card.currentStatus === applied.status) && number(card.parity) >= number(applied.parityFrom) && number(card.parity) <= number(applied.parityTo) && (!applied.keyword.trim() || `${card.animalNo} ${card.earTag}`.toLowerCase().includes(applied.keyword.trim().toLowerCase()))).sort((a, b) => (applied.sortDirection === "asc" ? 1 : -1) * compare(a, b, applied.sortKey)), [applied, cards]);
  const allChecked = rows.length > 0 && rows.every((row) => selected.has(row.animalNo));
  function search() { setApplied(query); setSearched(true); setSelected(new Set()); setMessage(""); }
  function toggleAll() { setSelected(allChecked ? new Set() : new Set(rows.map((row) => row.animalNo))); }
  function showSelectedCards() { const chosen = rows.filter((row) => selected.has(row.animalNo)); if (!chosen.length) { setMessage("확인할 모돈을 체크해 주세요."); return; } setPrintCards(chosen); setMessage(""); window.setTimeout(() => document.getElementById("sow-card-preview")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }

  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 모돈리스트 / 모돈카드</p><h1>모돈카드</h1><span>모돈을 조회하고 선택해 전체 생산성적 카드를 출력합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}><div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>모돈카드 조회</h2><p>조회 후 출력할 모돈을 체크하세요.</p></div></div><span className={styles.newBadge}>전체 생산기록 연결</span></div><div className={styles.formSection}><div className={styles.reportFilterGrid}>
      <label className={styles.field}><span className={styles.fieldLabel}>모돈 현재상태</span><select value={query.status} onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value }))}><option value="all">전체</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className={styles.field}><span className={styles.fieldLabel}>산차 시작</span><input type="number" min="0" value={query.parityFrom} onChange={(e) => setQuery((q) => ({ ...q, parityFrom: e.target.value }))} /></label>
      <label className={styles.field}><span className={styles.fieldLabel}>산차 종료</span><input type="number" min="0" value={query.parityTo} onChange={(e) => setQuery((q) => ({ ...q, parityTo: e.target.value }))} /></label>
      <label className={styles.field}><span className={styles.fieldLabel}>모돈번호/이각번호</span><input value={query.keyword} onChange={(e) => setQuery((q) => ({ ...q, keyword: e.target.value }))} placeholder="번호 입력" /></label>
      <label className={styles.field}><span className={styles.fieldLabel}>정렬기준</span><select value={query.sortKey} onChange={(e) => setQuery((q) => ({ ...q, sortKey: e.target.value as SortKey }))}>{Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className={styles.field}><span className={styles.fieldLabel}>정렬방향</span><select value={query.sortDirection} onChange={(e) => setQuery((q) => ({ ...q, sortDirection: e.target.value as SortDirection }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
      <div className={styles.reportActionButtons}><button type="button" className={styles.filterButton} onClick={search}><Search size={16} />조회</button></div>
    </div></div></section>
    <section className={`${styles.listCard} ${styles.printHidden}`}><div className={styles.listHead}><div><h2>모돈카드 대상</h2><p>체크한 모돈의 카드가 화면 아래에 표시됩니다.</p></div><strong>{searched ? `조회 ${rows.length}두 · 선택 ${selected.size}두` : "조회 전"}</strong></div><div className={styles.tableWrap}><table><thead><tr><th className={styles.checkColumn}><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="전체 선택" /></th><th>모돈번호</th><th>이각번호</th><th>품종</th><th>산차</th><th>현재상태</th><th>최종작업</th><th>최종작업일</th></tr></thead><tbody>{searched && rows.length ? rows.map((row) => <tr key={row.id} className={selected.has(row.animalNo) ? styles.selectedRow : ""}><td className={styles.checkColumn}><input type="checkbox" checked={selected.has(row.animalNo)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(row.animalNo) ? next.delete(row.animalNo) : next.add(row.animalNo); return next; })} /></td><td><strong>{row.animalNo}</strong></td><td>{row.earTag || "-"}</td><td>{row.breed}</td><td>{row.parity}</td><td><span className={styles.statusBadge}>{row.currentStatus}</span></td><td>{row.lastWork}</td><td>{row.lastWorkDate}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={8}>{searched ? "조회조건에 해당하는 모돈이 없습니다." : "조회 버튼을 누르면 모돈 목록이 표시됩니다."}</td></tr>}</tbody></table></div><div className={styles.sowCardActions}><span>{message}</span><button type="button" onClick={showSelectedCards}><FileText size={16} />선택 모돈카드 보기</button></div></section>
    {printCards.length ? <div id="sow-card-preview" className={styles.sowCardPreviewHead}><div><strong>모돈카드 미리보기</strong><span>선택한 {printCards.length}두의 전체 생산성적입니다.</span></div><button type="button" onClick={() => window.print()}><Printer size={16} />인쇄</button></div> : null}
    <div className={styles.sowCardPrintArea}>{printCards.map((card) => <SowCard key={card.animalNo} card={card} />)}</div>
  </ReportShell>;
}

function SowCard({ card }: { card: Card }) {
  const totalBorn = card.farrowings.reduce((sum, r) => sum + number(r.totalBorn), 0), liveBorn = card.farrowings.reduce((sum, r) => sum + number(r.liveFemale) + number(r.liveMale), 0), stillborn = card.farrowings.reduce((sum, r) => sum + number(r.stillborn), 0), mummified = card.farrowings.reduce((sum, r) => sum + number(r.mummified), 0), nursingStart = card.farrowings.reduce((sum, r) => sum + number(r.nursingStart), 0), weaned = card.weanings.reduce((sum, r) => sum + number(r.femaleCount) + number(r.maleCount), 0);
  const activeYears = Math.max(daysBetween(card.intakeDate, card.lastWorkDate) / 365, 1), recurrence = card.incidents.filter((r) => r.cause === "재발").length, abortions = card.incidents.filter((r) => r.cause === "유산").length;
  const farrowingIntervals = card.farrowings.slice(1).map((r, i) => daysBetween(card.farrowings[i].farrowingDate, r.farrowingDate));
  const avgFarrowingInterval = farrowingIntervals.length ? farrowingIntervals.reduce((a, b) => a + b, 0) / farrowingIntervals.length : 0;
  const gestations = card.farrowings.map((r) => daysBetween(r.matingDate, r.farrowingDate)).filter(Boolean), nursingDays = card.weanings.map((r) => daysBetween(r.farrowingDate, r.weaningDate)).filter(Boolean);
  return <article className={styles.sowCardSheet}><header><small>피그매니저 · 참든팜</small><h1>{card.animalNo}</h1><p>{card.currentStatus} · 최종작업 {card.lastWork} {card.lastWorkDate}</p></header><div className={styles.sowCardIdentity}><span>품종 <b>{card.breed}</b></span><span>이각번호 <b>{card.earTag || "-"}</b></span><span>산차 <b>{card.parity}</b></span><span>출생일 <b>{card.birthDate}</b></span><span>전입일 <b>{card.intakeDate}</b></span><span>구입처 <b>{card.source || "-"}</b></span></div>
    <h2>산차별 생산성적</h2><div className={styles.sowCardWideTable}><table><thead><tr><th>산차</th><th>재귀일</th><th>교배일</th><th>웅돈1</th><th>웅돈2</th><th>웅돈3</th><th>분만일</th><th>이유일</th><th>임신기간</th><th>포유기간</th><th>총산</th><th>사산</th><th>미라</th><th>실산</th><th>폐사</th><th>양자</th><th>이유</th></tr></thead><tbody>{card.farrowings.length ? card.farrowings.map((f) => { const mating = card.matings.filter((m) => m.matingDate <= f.farrowingDate).sort((a, b) => b.matingDate.localeCompare(a.matingDate))[0], weaning = card.weanings.find((w) => w.farrowingDate === f.farrowingDate), previousWeaning = card.weanings.filter((w) => w.weaningDate < (mating?.matingDate || f.matingDate)).sort((a, b) => b.weaningDate.localeCompare(a.weaningDate))[0], nursing = card.nursing.filter((n) => n.farrowingDate === f.farrowingDate), deaths = nursing.filter((n) => n.category === "포유자돈폐사").reduce((s, n) => s + number(n.femaleCount) + number(n.maleCount), 0), foster = nursing.reduce((s, n) => s + (n.category === "양자전입" ? 1 : n.category === "양자전출" ? -1 : 0) * (number(n.femaleCount) + number(n.maleCount)), 0); return <tr key={f.id}><td>{f.parity}</td><td>{previousWeaning ? daysBetween(previousWeaning.weaningDate, mating?.matingDate || f.matingDate) : "-"}</td><td>{mating?.matingDate || f.matingDate}</td><td>{mating?.boar1 || "-"}</td><td>{mating?.boar2 || "-"}</td><td>{mating?.boar3 || "-"}</td><td>{f.farrowingDate}</td><td>{weaning?.weaningDate || "-"}</td><td>{daysBetween(mating?.matingDate || f.matingDate, f.farrowingDate)}</td><td>{weaning ? daysBetween(f.farrowingDate, weaning.weaningDate) : "-"}</td><td>{f.totalBorn}</td><td>{f.stillborn}</td><td>{f.mummified}</td><td>{number(f.liveFemale) + number(f.liveMale)}</td><td>{deaths}</td><td>{foster}</td><td>{weaning ? number(weaning.femaleCount) + number(weaning.maleCount) : "-"}</td></tr>; }) : <tr><td colSpan={17}>분만 성적이 없습니다.</td></tr>}</tbody></table></div>
    <h2>누적 생산성적</h2><div className={styles.sowCardSummary}><span>모돈회전율<b>{(card.farrowings.length / activeYears).toFixed(2)}</b></span><span>PSY<b>{(weaned / activeYears).toFixed(1)}</b></span><span>재발횟수<b>{recurrence}</b></span><span>재발교배율<b>{card.matings.length ? ((recurrence / card.matings.length) * 100).toFixed(1) : "0.0"}%</b></span><span>유산횟수<b>{abortions}</b></span><span>총산<b>{totalBorn} / {card.farrowings.length ? (totalBorn / card.farrowings.length).toFixed(1) : "0.0"}</b></span><span>사산<b>{stillborn} / {card.farrowings.length ? (stillborn / card.farrowings.length).toFixed(1) : "0.0"}</b></span><span>미라<b>{mummified} / {card.farrowings.length ? (mummified / card.farrowings.length).toFixed(1) : "0.0"}</b></span><span>실산<b>{liveBorn} / {card.farrowings.length ? (liveBorn / card.farrowings.length).toFixed(1) : "0.0"}</b></span><span>이유자돈수<b>{weaned} / {card.weanings.length ? (weaned / card.weanings.length).toFixed(1) : "0.0"}</b></span><span>포유육성율<b>{nursingStart ? ((weaned / nursingStart) * 100).toFixed(1) : "0.0"}%</b></span><span>임신/포유기간<b>{gestations.length ? (gestations.reduce((a, b) => a + b, 0) / gestations.length).toFixed(1) : "0.0"} / {nursingDays.length ? (nursingDays.reduce((a, b) => a + b, 0) / nursingDays.length).toFixed(1) : "0.0"}</b></span><span>분만간격<b>{avgFarrowingInterval.toFixed(1)}일</b></span></div>
    <h2>전체 작업이력</h2><table><thead><tr><th>작업일</th><th>구분</th><th>산차</th><th>내용</th><th>장소</th></tr></thead><tbody>{card.events.map((e, i) => <tr key={`${e.date}-${e.category}-${i}`}><td>{e.date}</td><td>{e.category}</td><td>{e.parity || "-"}</td><td>{e.detail}</td><td>{e.location || "-"}</td></tr>)}</tbody></table></article>;
}
