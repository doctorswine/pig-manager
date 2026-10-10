"use client";

import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Menu,
  PiggyBank,
  Plus,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  defaultFatteningGroupRecords,
  FatteningGroupRecord,
  readStoredFatteningGroupRecords,
  storeFatteningGroupRecords,
} from "../_data/group-records";
import styles from "../../sows/intake/page.module.css";

type FormState = Omit<FatteningGroupRecord, "id">;
type SortField = "startDate" | "groupId" | "location";
type SortDirection = "desc" | "asc";
type FieldProps = { label: string; required?: boolean; help?: string; children: React.ReactNode };

const sections = [
  { label: "그룹등록", href: "/production/fattening-groups/registration" },
  { label: "두수관리", href: "/production/fattening-groups/movement-intake" },
  { label: "그룹종료", href: "/production/fattening-groups/closure" },
];

const emptyForm: FormState = {
  groupId: "",
  startDate: "",
  location: "",
  sex: "혼합",
  breed: "혼합",
  startAge: "",
  femaleCount: "0",
  maleCount: "0",
  note: "",
};

function Field({ label, required, help, children }: FieldProps) {
  return <label className={styles.field}><span className={styles.fieldLabel}>{label}{required ? <b>*</b> : null}{help ? <CircleHelp size={14} aria-label={help} /> : null}</span>{children}</label>;
}

function countValue(value: string) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

export default function GroupRegistrationPageContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [records, setRecords] = useState<FatteningGroupRecord[]>(defaultFatteningGroupRecords);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [breedFilter, setBreedFilter] = useState("");
  const [fromDate, setFromDate] = useState("2026-08-26");
  const [toDate, setToDate] = useState("2026-09-26");
  const [sortField, setSortField] = useState<SortField>("startDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setRecords(readStoredFatteningGroupRecords());
  }, []);

  const groupIdDuplicate = Boolean(form.groupId.trim()) && records.some((record) => record.groupId.trim().toLowerCase() === form.groupId.trim().toLowerCase());
  const formTotalCount = countValue(form.femaleCount) + countValue(form.maleCount);
  const totalRegisteredCount = records.reduce((total, record) => total + countValue(record.femaleCount) + countValue(record.maleCount), 0);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesKeyword = !keyword || `${record.groupId} ${record.location} ${record.sex} ${record.breed} ${record.note}`.toLowerCase().includes(keyword);
      const matchesBreed = !breedFilter || record.breed === breedFilter;
      const matchesDate = (!fromDate || record.startDate >= fromDate) && (!toDate || record.startDate <= toDate);
      return matchesKeyword && matchesBreed && matchesDate;
    }).sort((left, right) => left[sortField].localeCompare(right[sortField], "ko", { numeric: true }) * (sortDirection === "asc" ? 1 : -1));
  }, [breedFilter, fromDate, query, records, sortDirection, sortField, toDate]);

  const allFilteredSelected = filteredRecords.length > 0 && filteredRecords.every((record) => selectedRecordIds.has(record.id));

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.groupId.trim() || !form.startDate) {
      setNotice("그룹ID/그룹명과 시작일자를 입력해 주세요.");
      return;
    }
    if (groupIdDuplicate) {
      setNotice("이미 등록된 그룹ID/그룹명입니다.");
      return;
    }
    const startAge = Number(form.startAge || 0);
    const femaleCount = Number(form.femaleCount || 0);
    const maleCount = Number(form.maleCount || 0);
    if (!Number.isInteger(startAge) || startAge < 0 || !Number.isInteger(femaleCount) || femaleCount < 0 || !Number.isInteger(maleCount) || maleCount < 0) {
      setNotice("시작일령과 입식두수는 0 이상의 정수로 입력해 주세요.");
      return;
    }
    if (femaleCount + maleCount < 1) {
      setNotice("입식두수는 암·수 합계가 1두 이상이어야 합니다.");
      return;
    }
    const nextRecord: FatteningGroupRecord = { id: Date.now(), ...form, groupId: form.groupId.trim(), location: form.location.trim(), note: form.note.trim() };
    const nextRecords = [nextRecord, ...records];
    setRecords(nextRecords);
    storeFatteningGroupRecords(nextRecords);
    setNotice(`${nextRecord.groupId} 그룹을 ${femaleCount + maleCount}두로 등록했습니다.`);
    setForm(emptyForm);
  }

  function toggleRecord(recordId: number) {
    setSelectedRecordIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId); else next.add(recordId);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedRecordIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filteredRecords.forEach((record) => next.delete(record.id));
      else filteredRecords.forEach((record) => next.add(record.id));
      return next;
    });
  }

  function deleteSelectedRecords() {
    if (!selectedRecordIds.size) return;
    const deletedCount = selectedRecordIds.size;
    const nextRecords = records.filter((record) => !selectedRecordIds.has(record.id));
    setRecords(nextRecords);
    storeFatteningGroupRecords(nextRecords);
    setSelectedRecordIds(new Set());
    setNotice(`선택한 그룹 기록 ${deletedCount}건을 삭제했습니다.`);
  }

  return <div className={styles.shell}>
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
      <div className={styles.brand}><span><PiggyBank size={21} /></span><strong>피그매니저</strong><button onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기"><X size={19} /></button></div>
      <Link className={styles.backLink} href="/"><ArrowLeft size={17} /> 대시보드</Link>
      <div className={styles.navGroup}>
        <div className={styles.navTitle}><span>생산관리</span><ChevronDown size={15} /></div>
        <div className={styles.navSection}>모돈개체관리</div>
        <Link className={styles.navItem} href="/production/sows/intake"><i />전입관리</Link><Link className={styles.navItem} href="/production/sows/first-estrus"><i />초발정관리</Link><Link className={styles.navItem} href="/production/sows/breeding/mating"><i />번식관리</Link><Link className={styles.navItem} href="/production/sows/backfat"><i />등지방관리</Link><Link className={styles.navItem} href="/production/sows/cull"><i />도폐사관리</Link>
        <div className={styles.navSection}>웅돈개체관리</div>
        <Link className={styles.navItem} href="/production/boars/intake"><i />웅돈 전입관리</Link><Link className={styles.navItem} href="/production/boars/cull"><i />웅돈 도폐사관리</Link>
        <div className={styles.navSection}>비육돈그룹관리</div>
        {sections.map((section) => section.label === "그룹등록" ? <span className={styles.activeNav} key={section.label}><i />{section.label}</span> : <Link className={styles.navItem} href={section.href} key={section.label}><i />{section.label}</Link>)}
      </div>
    </aside>
    {sidebarOpen ? <button className={styles.scrim} aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /> : null}

    <main className={styles.main}>
      <header className={styles.topbar}><button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button><div><small>현재 농장</small><strong>해솔 번식농장</strong></div><span className={styles.topbarStatus}>브라우저 저장</span></header>
      <div className={styles.content}>
        <section className={styles.heading}><div><p>생산관리 / 비육돈그룹관리</p><h1>그룹등록</h1><span>비육돈 그룹의 기본정보와 최초 입식두수를 등록합니다.</span></div><span className={styles.cycleBadge}><Warehouse size={14} /> 총 {records.length}개 그룹 · {totalRegisteredCount}두</span></section>
        <nav className={`${styles.breedingTabs} ${styles.compactTabs}`} aria-label="비육돈그룹관리 하위 메뉴">{sections.map((section) => <Link className={section.label === "그룹등록" ? styles.activeBreedingTab : ""} href={section.href} key={section.label}>{section.label}</Link>)}</nav>

        <form className={styles.formCard} onSubmit={submitForm}>
          <div className={styles.cardHead}><div><span className={styles.cardIcon}><Plus size={18} /></span><div><h2>비육돈 그룹 등록</h2><p><b>*</b> 표시는 필수 입력 항목입니다.</p></div></div><span className={styles.newBadge}>신규등록</span></div>
          <div className={styles.formSection}><h3>그룹 정보</h3><div className={styles.formGrid}>
            <label className={`${styles.field} ${groupIdDuplicate ? styles.duplicateField : ""}`}><span className={styles.fieldLabel}>그룹ID/그룹명<b>*</b><CircleHelp size={14} aria-label="농장에서 사용하는 고유 그룹ID 또는 그룹명입니다." /></span><input value={form.groupId} onChange={(event) => updateField("groupId", event.target.value)} placeholder="예: 26-40" aria-invalid={groupIdDuplicate} />{groupIdDuplicate ? <small className={styles.duplicateMessage}>이미 등록된 그룹ID/그룹명입니다.</small> : null}</label>
            <Field label="시작일자" required><input type="date" value={form.startDate} onChange={(event) => updateField("startDate", event.target.value)} /></Field>
            <Field label="시작장소"><input value={form.location} onChange={(event) => updateField("location", event.target.value)} placeholder="돈사·돈방 입력" /></Field>
            <Field label="성별"><select value={form.sex} onChange={(event) => updateField("sex", event.target.value)}><option value="혼합">혼합</option><option value="암">암</option><option value="수">수</option></select></Field>
            <Field label="품종"><select value={form.breed} onChange={(event) => updateField("breed", event.target.value)}><option value="혼합">혼합</option><option value="F1">F1</option><option value="YY">YY</option><option value="LY">LY</option><option value="F2">F2</option><option value="YL">YL</option><option value="LL">LL</option><option value="DD">DD</option><option value="기타">기타</option></select></Field>
            <Field label="시작일령"><input type="number" min="0" step="1" inputMode="numeric" value={form.startAge} onChange={(event) => updateField("startAge", event.target.value)} placeholder="일령" /></Field>
            <Field label="입식두수(암)" required><input type="number" min="0" step="1" inputMode="numeric" value={form.femaleCount} onChange={(event) => updateField("femaleCount", event.target.value)} /></Field>
            <Field label="입식두수(수)" required><input type="number" min="0" step="1" inputMode="numeric" value={form.maleCount} onChange={(event) => updateField("maleCount", event.target.value)} /></Field>
            <Field label="입식두수 합계"><input value={`${formTotalCount}두`} readOnly /></Field>
          </div><Field label="비고"><textarea value={form.note} onChange={(event) => updateField("note", event.target.value)} placeholder="그룹 등록 시 참고사항을 입력하세요." rows={3} /></Field></div>
          <div className={styles.formActions}><button type="button" className={styles.resetButton} onClick={() => setForm(emptyForm)}><RotateCcw size={16} /> 초기화</button><button type="submit" className={styles.saveButton}><Save size={17} /> 저장</button></div>
        </form>

        <section className={styles.listCard}>
          <div className={styles.listHead}><div><h2>비육돈 그룹 기록 리스트</h2><p>시작일자와 그룹ID/그룹명으로 등록 내역을 조회합니다.</p></div><strong>조회 {filteredRecords.length}개 그룹</strong></div>
          <div className={styles.filters}>
            <label><span>시작일자</span><div className={styles.dateRange}><CalendarDays size={16} /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><i>~</i><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div></label>
            <label className={styles.searchFilter}><span>통합검색</span><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="그룹ID/그룹명, 장소, 비고" /></div></label>
            <label className={styles.sortFilter}><span>품종</span><div><select value={breedFilter} onChange={(event) => setBreedFilter(event.target.value)} aria-label="그룹 품종 조회"><option value="">전체</option><option value="혼합">혼합</option><option value="F1">F1</option><option value="YY">YY</option><option value="LY">LY</option><option value="F2">F2</option><option value="YL">YL</option><option value="LL">LL</option><option value="DD">DD</option><option value="기타">기타</option></select></div></label>
            <label className={styles.sortFilter}><span>정렬</span><div><select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)} aria-label="그룹 기록 정렬 기준"><option value="startDate">시작일자</option><option value="groupId">그룹ID/그룹명</option><option value="location">장소</option></select><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)} aria-label="그룹 기록 정렬 방향"><option value="desc">내림차순</option><option value="asc">오름차순</option></select></div></label>
            <button type="button" className={styles.filterButton} onClick={() => { setQuery(""); setBreedFilter(""); setFromDate("2026-08-26"); setToDate("2026-09-26"); setSortField("startDate"); setSortDirection("desc"); }}><SlidersHorizontal size={16} /> 초기화</button>
          </div>
          <div className={styles.tableWrap}><table><thead><tr><th className={styles.checkColumn}><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} aria-label="조회된 그룹 기록 전체 선택" /></th><th>그룹ID/그룹명</th><th>시작일자</th><th>장소</th><th>성별</th><th>품종</th><th>입식두수(암/수)</th><th>합계</th><th>시작일령</th><th>비고</th></tr></thead><tbody>{filteredRecords.length ? filteredRecords.map((record) => { const female = countValue(record.femaleCount); const male = countValue(record.maleCount); return <tr key={record.id} className={selectedRecordIds.has(record.id) ? styles.selectedRow : ""}><td className={styles.checkColumn}><input type="checkbox" checked={selectedRecordIds.has(record.id)} onChange={() => toggleRecord(record.id)} aria-label={`${record.groupId} 그룹 기록 선택`} /></td><td><strong>{record.groupId}</strong></td><td className={styles.cycleDate}>{record.startDate}</td><td>{record.location || "-"}</td><td>{record.sex}</td><td>{record.breed}</td><td>{female}/{male}</td><td>{female + male}두</td><td>{record.startAge ? `${record.startAge}일` : "-"}</td><td>{record.note || "-"}</td></tr>; }) : <tr><td className={styles.emptyTable} colSpan={10}>조건에 맞는 그룹 기록이 없습니다.</td></tr>}</tbody></table></div>
          <div className={styles.listFooter}><button type="button" className={styles.deleteButton} disabled={!selectedRecordIds.size} onClick={deleteSelectedRecords}><Trash2 size={15} /> 선택 삭제{selectedRecordIds.size ? ` (${selectedRecordIds.size})` : ""}</button><div className={styles.pagination}><button disabled>이전</button><strong>1</strong><button disabled>다음</button></div></div>
        </section>
      </div>
    </main>
    {notice ? <button className={styles.toast} onClick={() => setNotice("")}><span>{notice}</span><X size={15} /></button> : null}
  </div>;
}
