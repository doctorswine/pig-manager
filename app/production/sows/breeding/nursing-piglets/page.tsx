"use client";

import { Activity, ArrowLeft, CalendarDays, ChevronDown, CircleHelp, Menu, PiggyBank, RotateCcw, Save, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { defaultFarrowingRecords, FarrowingRecord, readStoredFarrowingRecords } from "../../_data/farrowing-records";
import { defaultNursingPigletRecords, NURSING_PIGLET_RECORDS_STORAGE_KEY, NursingPigletCategory, NursingPigletRecord, readStoredNursingPigletRecords } from "../../_data/nursing-piglet-records";
import styles from "../../intake/page.module.css";

type SortField = "workDate" | "animalNo" | "earTag";
type SortDirection = "desc" | "asc";
type NursingForm = Omit<NursingPigletRecord, "id" | "pigletAge">;

const emptyForm: NursingForm = { animalNo: "", earTag: "", parity: "0", farrowingDate: "", workDate: "", category: "포유자돈폐사", femaleCount: "0", maleCount: "0", cause: "원인불명", weight: "", note: "" };
const categoryOptions: NursingPigletCategory[] = ["포유자돈폐사", "부분이유", "양자전입", "양자전출"];
const mortalityCauses = ["원인불명", "포유중도태", "체중미달", "압사", "설사", "위축", "관절", "기타"];
const fosterCauses = ["산자수", "포유중단", "모돈폐사", "재포유모돈", "젖불량", "기타", "포유불능", "사고기록누락"];
function causesFor(category: NursingPigletCategory) { return category === "포유자돈폐사" ? mortalityCauses : category === "양자전입" || category === "양자전출" ? fosterCauses : []; }
const count = (value: string) => { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0; };
function pigletAge(farrowingDate: string, workDate: string) {
  if (!farrowingDate || !workDate) return "";
  const start = new Date(`${farrowingDate}T00:00:00`); const end = new Date(`${workDate}T00:00:00`);
  return String(Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000)));
}

type FieldProps = { label: string; required?: boolean; help?: string; children: React.ReactNode };
function Field({ label, required, help, children }: FieldProps) { return <label className={styles.field}><span className={styles.fieldLabel}>{label}{required ? <b>*</b> : null}{help ? <CircleHelp size={14} aria-label={help} /> : null}</span>{children}</label>; }

export default function NursingPigletsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState<NursingForm>(emptyForm);
  const [farrowingRecords, setFarrowingRecords] = useState<FarrowingRecord[]>(defaultFarrowingRecords);
  const [records, setRecords] = useState<NursingPigletRecord[]>(defaultNursingPigletRecords);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [sowQuery, setSowQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("workDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [fromDate, setFromDate] = useState("2026-08-19");
  const [toDate, setToDate] = useState("2026-09-19");
  const [notice, setNotice] = useState("");

  useEffect(() => { setFarrowingRecords(readStoredFarrowingRecords()); setRecords(readStoredNursingPigletRecords()); setRecordsLoaded(true); }, []);
  useEffect(() => { if (recordsLoaded) window.localStorage.setItem(NURSING_PIGLET_RECORDS_STORAGE_KEY, JSON.stringify(records)); }, [records, recordsLoaded]);

  const lactatingSows = useMemo(() => {
    const latest = new Map<string, FarrowingRecord>();
    [...farrowingRecords].sort((a, b) => b.farrowingDate.localeCompare(a.farrowingDate)).forEach((record) => { if (!latest.has(record.animalNo)) latest.set(record.animalNo, record); });
    const keyword = sowQuery.trim().toLowerCase();
    return [...latest.values()].filter((record) => !keyword || `${record.animalNo} ${record.earTag} ${record.breed}`.toLowerCase().includes(keyword));
  }, [farrowingRecords, sowQuery]);
  const selectedFarrowing = farrowingRecords.filter((record) => record.animalNo === form.animalNo && record.farrowingDate === form.farrowingDate)[0];
  function nursingCounts(farrowing?: FarrowingRecord) {
    if (!farrowing) return { female: 0, male: 0 };
    const culls = count(farrowing.cullSmall) + count(farrowing.cullDeformity) + count(farrowing.cullOther);
    let female = Math.max(0, count(farrowing.liveFemale) - culls + count(farrowing.fosterInFemale || "0") - count(farrowing.fosterOutFemale || "0"));
    let male = Math.max(0, count(farrowing.liveMale) + count(farrowing.fosterInMale || "0") - count(farrowing.fosterOutMale || "0"));
    records.filter((record) => record.animalNo === farrowing.animalNo && record.farrowingDate === farrowing.farrowingDate).forEach((record) => {
      const direction = record.category === "양자전입" ? 1 : -1;
      female = Math.max(0, female + direction * count(record.femaleCount)); male = Math.max(0, male + direction * count(record.maleCount));
    });
    return { female, male };
  }
  const currentNursing = nursingCounts(selectedFarrowing);
  const age = pigletAge(form.farrowingDate, form.workDate);
  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => record.workDate >= fromDate && record.workDate <= toDate && (!keyword || `${record.animalNo} ${record.earTag} ${record.category} ${record.cause}`.toLowerCase().includes(keyword))).sort((a, b) => {
      const left = sortField === "workDate" ? a.workDate : a[sortField]; const right = sortField === "workDate" ? b.workDate : b[sortField];
      return left.localeCompare(right, "ko", { numeric: true }) * (sortDirection === "asc" ? 1 : -1);
    });
  }, [fromDate, query, records, sortDirection, sortField, toDate]);
  const allSelected = filteredRecords.length > 0 && filteredRecords.every((record) => selectedIds.has(record.id));

  function selectSow(record: FarrowingRecord) { setForm((current) => ({ ...current, animalNo: record.animalNo, earTag: record.earTag, parity: record.parity, farrowingDate: record.farrowingDate })); setSelectorOpen(false); setSowQuery(""); }
  function handleSowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, record: FarrowingRecord) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectSow(record); } }
  function updateField(field: keyof NursingForm, value: string) {
    setForm((current) => {
      if (field !== "category") return { ...current, [field]: value };
      const category = value as NursingPigletCategory;
      return { ...current, category, cause: causesFor(category)[0] ?? "" };
    });
  }
  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFarrowing) { setNotice("포유자돈 기록을 입력할 모돈을 먼저 선택해 주세요."); return; }
    if (!form.workDate) { setNotice("기록 일자를 입력해 주세요."); return; }
    if (form.workDate < form.farrowingDate) { setNotice("기록 일자는 분만일보다 빠를 수 없습니다."); return; }
    const entered = count(form.femaleCount) + count(form.maleCount);
    if (!entered) { setNotice("암·수 두수를 1두 이상 입력해 주세요."); return; }
    if (form.category !== "양자전입" && (count(form.femaleCount) > currentNursing.female || count(form.maleCount) > currentNursing.male)) { setNotice(`현재 포유두수 암 ${currentNursing.female}두 / 수 ${currentNursing.male}두 이내로 입력해 주세요.`); return; }
    if (causesFor(form.category).length > 0 && !form.cause) { setNotice(`${form.category} 원인을 선택해 주세요.`); return; }
    const record: NursingPigletRecord = { id: Date.now(), ...form, pigletAge: age };
    setRecords((current) => [record, ...current]); setNotice(`${form.animalNo}번 모돈의 ${form.category} 기록을 저장했습니다.`);
    setForm((current) => ({ ...current, workDate: "", femaleCount: "0", maleCount: "0", cause: causesFor(current.category)[0] ?? "", weight: "", note: "" }));
  }
  function toggleRecord(id: number) { setSelectedIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function toggleAll() { setSelectedIds((current) => { const next = new Set(current); allSelected ? filteredRecords.forEach((record) => next.delete(record.id)) : filteredRecords.forEach((record) => next.add(record.id)); return next; }); }
  function deleteSelected() { const deleted = selectedIds.size; if (!deleted) return; setRecords((current) => current.filter((record) => !selectedIds.has(record.id))); setSelectedIds(new Set()); setNotice(`선택한 포유자돈 기록 ${deleted}건을 삭제했습니다.`); }

  return <div className={styles.shell}>
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}><div className={styles.brand}><span><PiggyBank size={21} /></span><strong>피그매니저</strong><button onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기"><X size={19} /></button></div><Link className={styles.backLink} href="/"><ArrowLeft size={17} /> 대시보드</Link><div className={styles.navGroup}><div className={styles.navTitle}><span>생산관리</span><ChevronDown size={15} /></div><div className={styles.navSection}>모돈개체관리</div><Link className={styles.navItem} href="/production/sows/intake"><i />전입관리</Link><Link className={styles.navItem} href="/production/sows/first-estrus"><i />초발정관리</Link><span className={styles.activeNav}><i />번식관리</span><Link className={styles.navItem} href="/production/sows/backfat"><i />등지방관리</Link><Link className={styles.navItem} href="/production/sows/cull"><i />도폐사관리</Link></div></aside>
    {sidebarOpen ? <button className={styles.scrim} aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /> : null}
    <main className={styles.main}><header className={styles.topbar}><button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button><div><small>현재 농장</small><strong>해솔 번식농장</strong></div><span className={styles.topbarStatus}>예시 데이터</span></header><div className={styles.content}>
      <section className={styles.heading}><div><p>생산관리 / 모돈개체관리</p><h1>번식관리</h1><span>포유 중인 모돈을 기준으로 자돈의 증감 기록을 관리합니다.</span></div></section>
      <nav className={styles.breedingTabs} aria-label="번식관리 기록 구분"><Link href="/production/sows/breeding/mating">교배</Link><Link href="/production/sows/breeding/pregnancy-incident">임신사고</Link><Link href="/production/sows/breeding/farrowing">분만</Link><Link className={styles.activeBreedingTab} href="/production/sows/breeding/nursing-piglets">포유자돈</Link><Link href="/production/sows/breeding/weaning">이유</Link></nav>
      <section className={styles.infoStrip} aria-label="선택 모돈 정보"><div><span>모돈번호</span><strong>{form.animalNo || "선택 전"}</strong></div><div><span>이각번호</span><strong>{form.earTag || "-"}</strong></div><div><span>산차</span><strong>{form.parity}산</strong></div><div><span>분만일</span><strong>{form.farrowingDate || "-"}</strong></div><div><span>현재 포유두수</span><strong>{currentNursing.female} / {currentNursing.male}두</strong></div><div><span>합계</span><strong>{currentNursing.female + currentNursing.male}두</strong></div></section>
      <form className={styles.formCard} onSubmit={submitForm}><div className={styles.cardHead}><div><span className={styles.cardIcon}><Activity size={18} /></span><div><h2>포유자돈 기록 입력</h2><p>모돈을 먼저 선택한 뒤 기록을 입력하세요.</p></div></div><span className={styles.newBadge}>포유자돈</span></div>
        <div className={styles.formSection}><h3>포유 모돈 선택</h3><div className={styles.formGrid}><label className={styles.field}><span className={styles.fieldLabel}>모돈번호<b>*</b><CircleHelp size={14} aria-label="최근 분만 기록이 있는 포유 모돈만 선택할 수 있습니다." /></span><div className={styles.selectorInput}><Search size={16} /><input value={selectorOpen ? sowQuery : form.animalNo} onFocus={() => { setSelectorOpen(true); setSowQuery(form.animalNo); }} onChange={(event) => setSowQuery(event.target.value)} placeholder="포유 모돈 검색·선택" autoComplete="off" /><ChevronDown size={16} /></div></label><Field label="이각번호"><span className={styles.calculatedField}>{form.earTag || "모돈 선택 필요"}</span></Field><Field label="분만일"><span className={styles.calculatedField}>{form.farrowingDate || "모돈 선택 필요"}</span></Field>
          {selectorOpen ? <div className={styles.sowSelector}><div className={styles.sowSelectorHead}><div><strong>포유 모돈 목록</strong><span>최근 분만 기록이 있는 모돈만 표시됩니다.</span></div><button type="button" onClick={() => setSelectorOpen(false)} aria-label="선택 목록 닫기"><X size={16} /></button></div><div className={styles.sowSelectorTable}><table><thead><tr><th>모돈번호</th><th>이각번호</th><th>품종</th><th>산차</th><th>분만일</th><th>현재 포유두수(암/수)</th></tr></thead><tbody>{lactatingSows.length ? lactatingSows.map((record) => { const current = nursingCounts(record); return <tr key={record.id} tabIndex={0} onClick={() => selectSow(record)} onKeyDown={(event) => handleSowKeyDown(event, record)}><td><strong>{record.animalNo}</strong></td><td>{record.earTag || "-"}</td><td>{record.breed}</td><td>{record.parity}산</td><td>{record.farrowingDate}</td><td>{current.female} / {current.male}</td></tr>; }) : <tr><td colSpan={6} className={styles.emptySelector}>선택 가능한 포유 모돈이 없습니다.</td></tr>}</tbody></table></div><p>총 {lactatingSows.length}두 · 분만 기록이 있어야 포유자돈 기록을 입력할 수 있습니다.</p></div> : null}
        </div></div>
        <div className={styles.formSection}><h3>포유자돈 정보</h3><div className={styles.matingGrid}><Field label="일자" required><input type="date" value={form.workDate} onChange={(event) => updateField("workDate", event.target.value)} /></Field><Field label="일령"><span className={styles.calculatedField}>{age === "" ? "모돈과 일자 선택 필요" : `${age}일령`}</span></Field><Field label="포유두수(암/수)"><span className={styles.calculatedField}>{currentNursing.female} / {currentNursing.male}두</span></Field><Field label="구분" required><select value={form.category} onChange={(event) => updateField("category", event.target.value)}>{categoryOptions.map((category, index) => <option key={category} value={category}>{index + 1}.{category}</option>)}</select></Field><Field label="두수(암/수)" required><div className={styles.compoundInput}><input type="number" min="0" value={form.femaleCount} onChange={(event) => updateField("femaleCount", event.target.value)} aria-label="암 두수" /><input type="number" min="0" value={form.maleCount} onChange={(event) => updateField("maleCount", event.target.value)} aria-label="수 두수" /></div></Field><Field label="원인" required={causesFor(form.category).length > 0}><select value={form.cause} disabled={causesFor(form.category).length === 0} onChange={(event) => updateField("cause", event.target.value)}>{causesFor(form.category).length === 0 ? <option value="">해당 없음</option> : causesFor(form.category).map((cause, index) => <option key={cause} value={cause}>{index + 1}.{cause}</option>)}</select></Field><Field label="체중(kg)"><input type="number" min="0" step="0.01" value={form.weight} onChange={(event) => updateField("weight", event.target.value)} /></Field></div><Field label="비고"><textarea rows={3} value={form.note} onChange={(event) => updateField("note", event.target.value)} /></Field></div>
        <div className={styles.formActions}><button type="button" className={styles.resetButton} onClick={() => setForm(emptyForm)}><RotateCcw size={16} />초기화</button><button type="submit" className={styles.saveButton}><Save size={17} />저장</button></div>
      </form>
      <section className={styles.listCard}><div className={styles.listHead}><div><h2>포유자돈 기록 리스트</h2><p>모돈별 포유자돈 증감 내역을 조회합니다.</p></div><strong>총 {filteredRecords.length}건</strong></div><div className={styles.filters}><label><span>일자</span><div className={styles.dateRange}><CalendarDays size={16} /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><i>~</i><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div></label><label className={styles.searchFilter}><span>통합검색</span><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="모돈번호, 이각번호, 구분, 원인" /></div></label><label className={styles.sortFilter}><span>정렬</span><div><select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}><option value="workDate">작업일</option><option value="animalNo">모돈번호</option><option value="earTag">이각번호</option></select><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)}><option value="desc">내림차순</option><option value="asc">오름차순</option></select></div></label><button type="button" className={styles.filterButton} onClick={() => { setQuery(""); setSortField("workDate"); setSortDirection("desc"); }}><SlidersHorizontal size={16} />초기화</button></div>
        <div className={styles.tableWrap}><table><thead><tr><th className={styles.checkColumn}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="조회된 포유자돈 기록 전체 선택" /></th><th>모돈번호</th><th>이각번호</th><th>산차</th><th>구분</th><th>일자</th><th>일령</th><th>두수(암/수)</th><th>원인</th><th>체중</th><th>비고</th></tr></thead><tbody>{filteredRecords.length ? filteredRecords.map((record) => <tr key={record.id} className={selectedIds.has(record.id) ? styles.selectedRow : ""}><td className={styles.checkColumn}><input type="checkbox" checked={selectedIds.has(record.id)} onChange={() => toggleRecord(record.id)} aria-label={`${record.animalNo}번 포유자돈 기록 선택`} /></td><td><strong>{record.animalNo}</strong></td><td>{record.earTag || "-"}</td><td>{record.parity}산</td><td><span className={styles.statusBadge}>{record.category}</span></td><td>{record.workDate}</td><td>{record.pigletAge}일</td><td>{record.femaleCount} / {record.maleCount}</td><td>{record.cause || "-"}</td><td>{record.weight ? `${record.weight}kg` : "-"}</td><td>{record.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={11}>조건에 맞는 포유자돈 기록이 없습니다.</td></tr>}</tbody></table></div><div className={styles.listFooter}><button type="button" className={styles.deleteButton} disabled={!selectedIds.size} onClick={deleteSelected}><Trash2 size={15} />선택 삭제{selectedIds.size ? ` (${selectedIds.size})` : ""}</button><div className={styles.pagination}><button disabled>이전</button><strong>1</strong><button disabled>다음</button></div></div>
      </section>
    </div></main>
    {notice ? <button className={styles.toast} onClick={() => setNotice("")}><span>{notice}</span><X size={15} /></button> : null}
  </div>;
}
