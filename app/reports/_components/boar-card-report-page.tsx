"use client";

import { FileText, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BoarCullRecord, readStoredBoarCullRecords } from "../../production/boars/_data/cull-records";
import { BoarIntakeRecord, readStoredBoarIntakeRecords } from "../../production/boars/_data/intake-records";
import { MatingRecord, readStoredMatingRecords } from "../../production/sows/_data/mating-records";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

type Status = "생존" | "도태" | "폐사";
type SortKey = "animalNo" | "earTag" | "breed" | "boarType" | "birthDate" | "intakeDate" | "currentStatus" | "lastWorkDate";
type Query = { status: "all" | Status; keyword: string; sortKey: SortKey; direction: "asc" | "desc" };
type Usage = { mating: MatingRecord; order: number };
type Card = BoarIntakeRecord & { currentStatus: Status; lastWork: string; lastWorkDate: string; cull?: BoarCullRecord; usages: Usage[] };
const INITIAL: Query = { status: "all", keyword: "", sortKey: "animalNo", direction: "asc" };
const sortLabels: Record<SortKey, string> = { animalNo: "웅돈번호", earTag: "이각번호", breed: "품종", boarType: "웅돈구분", birthDate: "출생일", intakeDate: "전입일", currentStatus: "현재상태", lastWorkDate: "최종작업일" };

function statusOf(cull?: BoarCullRecord): Status { return !cull ? "생존" : cull.type === "폐사" ? "폐사" : "도태"; }
function compare(a: Card, b: Card, key: SortKey) { return String(a[key] ?? "").localeCompare(String(b[key] ?? ""), "ko", { numeric: true }); }

export default function BoarCardReportPage() {
  const [cards, setCards] = useState<Card[]>([]), [query, setQuery] = useState<Query>(INITIAL), [applied, setApplied] = useState<Query>(INITIAL);
  const [searched, setSearched] = useState(false), [selected, setSelected] = useState<Set<string>>(new Set()), [preview, setPreview] = useState<Card[]>([]), [message, setMessage] = useState("");
  useEffect(() => {
    const culls = readStoredBoarCullRecords(), matings = readStoredMatingRecords();
    setCards(readStoredBoarIntakeRecords().map((boar) => {
      const cull = culls.filter((r) => r.animalNo === boar.animalNo).sort((a, b) => b.eventDate.localeCompare(a.eventDate))[0];
      const usages: Usage[] = [];
      matings.forEach((mating) => [mating.boar1, mating.boar2, mating.boar3].forEach((number, index) => { if (number && number === boar.animalNo) usages.push({ mating, order: index + 1 }); }));
      usages.sort((a, b) => a.mating.matingDate.localeCompare(b.mating.matingDate));
      const lastUsage = usages.at(-1)?.mating.matingDate || "";
      const lastWorkDate = [boar.intakeDate, boar.serviceStartDate, lastUsage, cull?.eventDate || ""].filter(Boolean).sort().at(-1) || boar.intakeDate;
      const lastWork = cull?.eventDate === lastWorkDate ? cull.type : lastUsage === lastWorkDate ? "교배사용" : boar.serviceStartDate === lastWorkDate ? "종모편입" : "전입";
      return { ...boar, currentStatus: statusOf(cull), lastWork, lastWorkDate, cull, usages };
    }));
  }, []);
  const rows = useMemo(() => cards.filter((r) => (applied.status === "all" || r.currentStatus === applied.status) && (!applied.keyword.trim() || `${r.animalNo} ${r.earTag} ${r.electronicTag}`.toLowerCase().includes(applied.keyword.trim().toLowerCase()))).sort((a, b) => (applied.direction === "asc" ? 1 : -1) * compare(a, b, applied.sortKey)), [applied, cards]);
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.animalNo));
  function search() { setApplied(query); setSearched(true); setSelected(new Set()); setPreview([]); setMessage(""); }
  function toggleAll() { setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.animalNo))); }
  function showCards() { const chosen = rows.filter((r) => selected.has(r.animalNo)); if (!chosen.length) { setMessage("확인할 웅돈을 체크해 주세요."); return; } setPreview(chosen); setMessage(""); setTimeout(() => document.getElementById("boar-card-preview")?.scrollIntoView({ behavior: "smooth" }), 50); }
  return <ReportShell>
    <section className={`${styles.heading} ${styles.printHidden}`}><div><p>보고서 / 모돈리스트 / 웅돈카드</p><h1>웅돈카드</h1><span>웅돈을 조회하고 선택해 전입·혈통·교배사용·도폐사 이력 카드를 확인합니다.</span></div></section>
    <section className={`${styles.formCard} ${styles.printHidden}`}><div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>웅돈카드 조회</h2><p>현재상태와 번호를 조회한 뒤 출력할 웅돈을 체크하세요.</p></div></div><span className={styles.newBadge}>웅돈 기록 연결</span></div><div className={styles.formSection}><div className={styles.reportFilterGrid}>
      <label className={styles.field}><span className={styles.fieldLabel}>현재상태</span><select value={query.status} onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value as Query["status"] }))}><option value="all">전체</option><option>생존</option><option>도태</option><option>폐사</option></select></label>
      <label className={styles.field}><span className={styles.fieldLabel}>웅돈번호/이각번호</span><input value={query.keyword} onChange={(e) => setQuery((q) => ({ ...q, keyword: e.target.value }))} placeholder="번호 입력" /></label>
      <label className={styles.field}><span className={styles.fieldLabel}>정렬기준</span><select value={query.sortKey} onChange={(e) => setQuery((q) => ({ ...q, sortKey: e.target.value as SortKey }))}>{Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className={styles.field}><span className={styles.fieldLabel}>정렬방향</span><select value={query.direction} onChange={(e) => setQuery((q) => ({ ...q, direction: e.target.value as Query["direction"] }))}><option value="asc">오름차순</option><option value="desc">내림차순</option></select></label>
      <div className={styles.reportActionButtons}><button type="button" onClick={search}><Search size={16} />조회</button></div>
    </div></div></section>
    <section className={`${styles.listCard} ${styles.printHidden}`}><div className={styles.listHead}><div><h2>웅돈카드 대상</h2><p>체크한 웅돈의 카드가 화면 아래에 표시됩니다.</p></div><strong>{searched ? `조회 ${rows.length}두 · 선택 ${selected.size}두` : "조회 전"}</strong></div><div className={styles.tableWrap}><table><thead><tr><th className={styles.checkColumn}><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th><th>웅돈번호</th><th>이각번호</th><th>품종</th><th>웅돈구분</th><th>현재상태</th><th>최종작업</th><th>최종작업일</th></tr></thead><tbody>{searched && rows.length ? rows.map((r) => <tr key={r.id} className={selected.has(r.animalNo) ? styles.selectedRow : ""}><td className={styles.checkColumn}><input type="checkbox" checked={selected.has(r.animalNo)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(r.animalNo) ? next.delete(r.animalNo) : next.add(r.animalNo); return next; })} /></td><td><strong>{r.animalNo}</strong></td><td>{r.earTag || "-"}</td><td>{r.breed}</td><td>{r.boarType}</td><td><span className={styles.statusBadge}>{r.currentStatus}</span></td><td>{r.lastWork}</td><td>{r.lastWorkDate}</td></tr>) : <tr><td colSpan={8} className={styles.emptyTable}>{searched ? "조회조건에 해당하는 웅돈이 없습니다." : "조회 버튼을 누르면 웅돈 목록이 표시됩니다."}</td></tr>}</tbody></table></div><div className={styles.sowCardActions}><span>{message}</span><button type="button" onClick={showCards}><FileText size={16} />선택 웅돈카드 보기</button></div></section>
    {preview.length ? <div id="boar-card-preview" className={styles.sowCardPreviewHead}><div><strong>웅돈카드 미리보기</strong><span>선택한 {preview.length}두의 전체 기록입니다.</span></div><button type="button" onClick={() => window.print()}><Printer size={16} />인쇄</button></div> : null}
    <div className={styles.sowCardPrintArea}>{preview.map((card) => <BoarCard key={card.animalNo} card={card} />)}</div>
  </ReportShell>;
}

function BoarCard({ card }: { card: Card }) {
  const sows = new Set(card.usages.map((u) => u.mating.animalNo));
  return <article className={styles.sowCardSheet}><header><small>피그매니저 · 참든팜</small><h1>{card.animalNo}</h1><p>{card.boarType} · {card.currentStatus} · 최종작업 {card.lastWork} {card.lastWorkDate}</p></header>
    <div className={styles.sowCardIdentity}><span>품종 <b>{card.breed}</b></span><span>이각번호 <b>{card.earTag || "-"}</b></span><span>전자이표 <b>{card.electronicTag || "-"}</b></span><span>출생일 <b>{card.birthDate}</b></span><span>전입일 <b>{card.intakeDate}</b></span><span>종모편입일 <b>{card.serviceStartDate || "-"}</b></span><span>혈통번호 <b>{card.bloodlineNo || "-"}</b></span><span>혈통등급 <b>{card.pedigreeDegree || "-"}</b></span><span>PSS <b>{card.pss || "-"}</b></span><span>부 웅돈 <b>{card.sireNo || "-"}</b></span><span>모 웅돈 <b>{card.damNo || "-"}</b></span><span>구입처 <b>{card.source || "-"}</b></span></div>
    <h2>누적 사용성적</h2><div className={styles.sowCardSummary}><span>교배 사용횟수<b>{card.usages.length}</b></span><span>사용 모돈수<b>{sows.size}</b></span><span>최근 사용일<b>{card.usages.at(-1)?.mating.matingDate || "-"}</b></span><span>현재상태<b>{card.currentStatus}</b></span></div>
    <h2>교배 사용이력</h2><table><thead><tr><th>교배일</th><th>사용차수</th><th>모돈번호</th><th>이각번호</th><th>품종</th><th>산차</th><th>교배방법</th><th>장소</th><th>작업자</th></tr></thead><tbody>{card.usages.length ? card.usages.map((u, i) => <tr key={`${u.mating.id}-${u.order}-${i}`}><td>{u.mating.matingDate}</td><td>{u.order}차</td><td>{u.mating.animalNo}</td><td>{u.mating.earTag || "-"}</td><td>{u.mating.breed}</td><td>{u.mating.parity}</td><td>{u.order === 1 ? u.mating.method1 : u.order === 2 ? u.mating.method2 : u.mating.method3}</td><td>{u.mating.location || "-"}</td><td>{u.mating.worker || "-"}</td></tr>) : <tr><td colSpan={9}>교배 사용이력이 없습니다.</td></tr>}</tbody></table>
    <h2>전입·도폐사 기록</h2><table><thead><tr><th>전입일</th><th>전입체중</th><th>도폐사일</th><th>실제구분</th><th>원인</th><th>판매처/전출처</th><th>금액</th><th>비고</th></tr></thead><tbody><tr><td>{card.intakeDate}</td><td>{card.weight || "-"}</td><td>{card.cull?.eventDate || "-"}</td><td>{card.cull?.type || "-"}</td><td>{card.cull?.cause || "-"}</td><td>{card.cull?.buyer || "-"}</td><td>{card.cull ? Number(card.cull.saleAmount || 0).toLocaleString("ko-KR") : "-"}</td><td>{card.cull?.note || card.note || "-"}</td></tr></tbody></table>
  </article>;
}
