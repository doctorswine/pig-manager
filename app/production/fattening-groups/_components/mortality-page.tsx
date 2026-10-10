"use client";

import {
  ArrowLeft, CalendarDays, ChevronDown, CircleHelp, Menu, PiggyBank, RotateCcw,
  Save, Search, SlidersHorizontal, Trash2, Warehouse, X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { defaultFatteningGroupRecords, FatteningGroupRecord, readStoredFatteningGroupRecords } from "../_data/group-records";
import { defaultMovementIntakeRecords, MovementIntakeRecord, readStoredMovementIntakeRecords } from "../_data/movement-intake-records";
import {
  defaultFatteningMortalityRecords, FATTENING_MORTALITY_CAUSES,
  FatteningMortalityCause, FatteningMortalityRecord,
  readStoredFatteningMortalityRecords, storeFatteningMortalityRecords,
} from "../_data/mortality-records";
import styles from "../../sows/intake/page.module.css";

type SortField = "workDate" | "groupId" | "cause";
type SortDirection = "desc" | "asc";
type FieldProps = { label: string; required?: boolean; help?: string; children: React.ReactNode };

const sections = [
  { label: "그룹등록", href: "/production/fattening-groups/registration" },
  { label: "이동전입", href: "/production/fattening-groups/movement-intake" },
  { label: "폐사기록", href: "/production/fattening-groups/mortality" },
  { label: "전출/출하 기록", href: "/production/fattening-groups/outbound" },
  { label: "그룹종료", href: "/production/fattening-groups/closure" },
];

function Field({ label, required, help, children }: FieldProps) {
  return <label className={styles.field}><span className={styles.fieldLabel}>{label}{required ? <b>*</b> : null}{help ? <CircleHelp size={14} aria-label={help} /> : null}</span>{children}</label>;
}

function countValue(value: string) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function daysBetween(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return 0;
  return Math.max(0, Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000));
}

export default function MortalityPageContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [groups, setGroups] = useState<FatteningGroupRecord[]>(defaultFatteningGroupRecords);
  const [movements, setMovements] = useState<MovementIntakeRecord[]>(defaultMovementIntakeRecords);
  const [records, setRecords] = useState<FatteningMortalityRecord[]>(defaultFatteningMortalityRecords);
  const [selectedGroup, setSelectedGroup] = useState<FatteningGroupRecord | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [groupQuery, setGroupQuery] = useState("");
  const [mortalityDate, setMortalityDate] = useState("");
  const [mortalityAge, setMortalityAge] = useState("");
  const [cause, setCause] = useState<FatteningMortalityCause>("위축");
  const [femaleCount, setFemaleCount] = useState("0");
  const [maleCount, setMaleCount] = useState("0");
  const [totalWeight, setTotalWeight] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [causeFilter, setCauseFilter] = useState("");
  const [fromDate, setFromDate] = useState("2026-08-26");
  const [toDate, setToDate] = useState("2026-09-26");
  const [sortField, setSortField] = useState<SortField>("workDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(() => new Set());
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setGroups(readStoredFatteningGroupRecords());
    setMovements(readStoredMovementIntakeRecords());
    setRecords(readStoredFatteningMortalityRecords());
  }, []);

  const currentCountsByGroup = useMemo(() => {
    const counts = new Map(groups.map((group) => [group.groupId, { female: countValue(group.femaleCount), male: countValue(group.maleCount) }]));
    movements.forEach((record) => {
      const destination = counts.get(record.groupId);
      if (destination) {
        destination.female += countValue(record.femaleCount);
        destination.male += countValue(record.maleCount);
      }
      if (record.sourceGroupId) {
        const source = counts.get(record.sourceGroupId);
        if (source) {
          source.female -= countValue(record.femaleCount);
          source.male -= countValue(record.maleCount);
        }
      }
    });
    records.forEach((record) => {
      const group = counts.get(record.groupId);
      if (group) {
        group.female -= countValue(record.femaleCount);
        group.male -= countValue(record.maleCount);
      }
    });
    return counts;
  }, [groups, movements, records]);

  const selectableGroups = useMemo(() => {
    const keyword = groupQuery.trim().toLowerCase();
    if (!keyword) return groups;
    return groups.filter((group) => `${group.groupId} ${group.location} ${group.breed}`.toLowerCase().includes(keyword));
  }, [groupQuery, groups]);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => {
      const group = groups.find((item) => item.groupId === record.groupId);
      const matchesKeyword = !keyword || `${record.groupId} ${group?.location ?? ""} ${record.cause} ${record.note}`.toLowerCase().includes(keyword);
      const matchesCause = !causeFilter || record.cause === causeFilter;
      const matchesDate = (!fromDate || record.mortalityDate >= fromDate) && (!toDate || record.mortalityDate <= toDate);
      return matchesKeyword && matchesCause && matchesDate;
    }).sort((left, right) => {
      const leftValue = sortField === "workDate" ? left.mortalityDate : left[sortField];
      const rightValue = sortField === "workDate" ? right.mortalityDate : right[sortField];
      return leftValue.localeCompare(rightValue, "ko", { numeric: true }) * (sortDirection === "asc" ? 1 : -1);
    });
  }, [causeFilter, fromDate, groups, query, records, sortDirection, sortField, toDate]);

  const selectedCounts = selectedGroup ? currentCountsByGroup.get(selectedGroup.groupId) : undefined;
  const currentFemaleCount = selectedCounts?.female ?? 0;
  const currentMaleCount = selectedCounts?.male ?? 0;
  const totalCount = countValue(femaleCount) + countValue(maleCount);
  const groupAge = selectedGroup ? countValue(selectedGroup.startAge) + daysBetween(selectedGroup.startDate, mortalityDate || "2026-09-26") : 0;
  const allFilteredSelected = filteredRecords.length > 0 && filteredRecords.every((record) => selectedRecordIds.has(record.id));
  const femaleTotal = records.reduce((total, record) => total + countValue(record.femaleCount), 0);
  const maleTotal = records.reduce((total, record) => total + countValue(record.maleCount), 0);

  function selectGroup(group: FatteningGroupRecord) {
    setSelectedGroup(group);
    setSelectorOpen(false);
    setGroupQuery("");
    setMortalityAge(String(countValue(group.startAge) + daysBetween(group.startDate, mortalityDate || group.startDate)));
  }

  function handleGroupRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, group: FatteningGroupRecord) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectGroup(group);
    }
  }

  function resetForm() {
    setSelectedGroup(null);
    setSelectorOpen(false);
    setGroupQuery("");
    setMortalityDate("");
    setMortalityAge("");
    setCause("위축");
    setFemaleCount("0");
    setMaleCount("0");
    setTotalWeight("");
    setNote("");
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGroup || !mortalityDate || !mortalityAge) {
      setNotice("그룹, 폐사일자, 폐사일령을 입력해 주세요.");
      return;
    }
    if (mortalityDate < selectedGroup.startDate) {
      setNotice("폐사일자는 그룹 시작일자보다 빠를 수 없습니다.");
      return;
    }
    const age = Number(mortalityAge);
    const female = Number(femaleCount || 0);
    const male = Number(maleCount || 0);
    const weight = Number(totalWeight || 0);
    if (!Number.isInteger(age) || age < 0 || !Number.isInteger(female) || female < 0 || !Number.isInteger(male) || male < 0 || (totalWeight && (!Number.isFinite(weight) || weight < 0))) {
      setNotice("폐사일령과 두수는 0 이상의 정수, 총생체중은 0 이상의 숫자로 입력해 주세요.");
      return;
    }
    if (female + male < 1) {
      setNotice("폐사 두수는 암·수 합계가 1두 이상이어야 합니다.");
      return;
    }
    if (female > currentFemaleCount || male > currentMaleCount) {
      setNotice("폐사 두수가 선택한 그룹의 현재 암·수 두수를 초과합니다.");
      return;
    }
    const nextRecord: FatteningMortalityRecord = {
      id: Date.now(), groupId: selectedGroup.groupId, mortalityDate, mortalityAge, cause,
      femaleCount, maleCount, totalWeight, note: note.trim(),
    };
    const nextRecords = [nextRecord, ...records];
    setRecords(nextRecords);
    storeFatteningMortalityRecords(nextRecords);
    setNotice(`${selectedGroup.groupId} 그룹의 폐사 ${female + male}두를 등록했습니다.`);
    resetForm();
  }

  function toggleRecord(recordId: number) {
    setSelectedRecordIds((current) => { const next = new Set(current); if (next.has(recordId)) next.delete(recordId); else next.add(recordId); return next; });
  }

  function toggleAllFiltered() {
    setSelectedRecordIds((current) => { const next = new Set(current); if (allFilteredSelected) filteredRecords.forEach((record) => next.delete(record.id)); else filteredRecords.forEach((record) => next.add(record.id)); return next; });
  }

  function deleteSelectedRecords() {
    if (!selectedRecordIds.size) return;
    const deletedCount = selectedRecordIds.size;
    const nextRecords = records.filter((record) => !selectedRecordIds.has(record.id));
    setRecords(nextRecords);
    storeFatteningMortalityRecords(nextRecords);
    setSelectedRecordIds(new Set());
    setNotice(`선택한 폐사 기록 ${deletedCount}건을 삭제했습니다.`);
  }

  return <div className={styles.shell}>
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
      <div className={styles.brand}><span><PiggyBank size={21} /></span><strong>피그매니저</strong><button onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기"><X size={19} /></button></div>
      <Link className={styles.backLink} href="/"><ArrowLeft size={17} /> 대시보드</Link>
      <div className={styles.navGroup}><div className={styles.navTitle}><span>생산관리</span><ChevronDown size={15} /></div><div className={styles.navSection}>모돈개체관리</div><Link className={styles.navItem} href="/production/sows/intake"><i />전입관리</Link><Link className={styles.navItem} href="/production/sows/first-estrus"><i />초발정관리</Link><Link className={styles.navItem} href="/production/sows/breeding/mating"><i />번식관리</Link><Link className={styles.navItem} href="/production/sows/backfat"><i />등지방관리</Link><Link className={styles.navItem} href="/production/sows/cull"><i />도폐사관리</Link><div className={styles.navSection}>웅돈개체관리</div><Link className={styles.navItem} href="/production/boars/intake"><i />웅돈 전입관리</Link><Link className={styles.navItem} href="/production/boars/cull"><i />웅돈 도폐사관리</Link><div className={styles.navSection}>비육돈그룹관리</div>{sections.map((section) => section.label === "폐사기록" ? <span className={styles.activeNav} key={section.label}><i />{section.label}</span> : <Link className={styles.navItem} href={section.href} key={section.label}><i />{section.label}</Link>)}</div>
    </aside>
    {sidebarOpen ? <button className={styles.scrim} aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /> : null}

    <main className={styles.main}>
      <header className={styles.topbar}><button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button><div><small>현재 농장</small><strong>해솔 번식농장</strong></div><span className={styles.topbarStatus}>브라우저 저장</span></header>
      <div className={styles.content}>
        <section className={styles.heading}><div><p>생산관리 / 비육돈그룹관리</p><h1>폐사기록</h1><span>비육돈 그룹에서 발생한 폐사 두수와 원인을 기록합니다.</span></div><span className={styles.cycleBadge}><Warehouse size={14} /> 총 {records.length}건</span></section>
        <nav className={styles.breedingTabs} aria-label="비육돈그룹관리 하위 메뉴">{sections.map((section) => <Link className={section.label === "폐사기록" ? styles.activeBreedingTab : ""} href={section.href} key={section.label}>{section.label}</Link>)}</nav>

        <form className={styles.formCard} onSubmit={submitForm}>
          <div className={styles.cardHead}><div><span className={styles.cardIcon}><Warehouse size={18} /></span><div><h2>폐사기록</h2><p>그룹등록에서 만든 그룹을 먼저 선택하세요.</p></div></div><span className={styles.newBadge}>신규등록</span></div>
          <div className={styles.animalSummary}>
            <label className={styles.field}><span className={styles.fieldLabel}>그룹ID/그룹명<b>*</b><CircleHelp size={14} aria-label="그룹등록에서 만든 그룹만 선택할 수 있습니다." /></span><div className={styles.selectorInput}><Search size={16} /><input value={selectorOpen ? groupQuery : selectedGroup?.groupId ?? ""} onFocus={() => { setSelectorOpen(true); setGroupQuery(selectedGroup?.groupId ?? ""); }} onChange={(event) => setGroupQuery(event.target.value)} placeholder="그룹 검색·선택" autoComplete="off" /><ChevronDown size={16} /></div></label>
            <Field label="그룹 시작일자"><input value={selectedGroup?.startDate ?? ""} placeholder="그룹 선택 시 자동 표시" readOnly /></Field>
            <Field label="현재장소"><input value={selectedGroup?.location ?? ""} placeholder="그룹 선택 시 자동 표시" readOnly /></Field>
            <Field label="그룹 시작일령"><input value={selectedGroup?.startAge ? `${selectedGroup.startAge}일` : ""} placeholder="그룹 선택 시 자동 표시" readOnly /></Field>
            <Field label="그룹 일령"><input value={selectedGroup ? `${groupAge}일` : ""} placeholder="폐사일자 기준 자동 계산" readOnly /></Field>
            <Field label="현재두수(암/수)"><input value={selectedGroup ? `${currentFemaleCount}/${currentMaleCount} (${currentFemaleCount + currentMaleCount}두)` : ""} placeholder="그룹 선택 시 자동 표시" readOnly /></Field>
            {selectorOpen ? <div className={styles.sowSelector} aria-label="비육돈 그룹 선택 목록"><div className={styles.sowSelectorHead}><div><strong>등록 그룹 목록</strong><span>폐사를 기록할 그룹을 선택하세요.</span></div><button type="button" onClick={() => setSelectorOpen(false)} aria-label="선택 목록 닫기"><X size={16} /></button></div><div className={styles.sowSelectorTable}><table><thead><tr><th>그룹ID/그룹명</th><th>시작일자</th><th>장소</th><th>성별</th><th>품종</th><th>현재두수</th></tr></thead><tbody>{selectableGroups.length ? selectableGroups.map((group) => <tr key={group.id} tabIndex={0} onClick={() => selectGroup(group)} onKeyDown={(event) => handleGroupRowKeyDown(event, group)}><td><strong>{group.groupId}</strong></td><td>{group.startDate}</td><td>{group.location || "-"}</td><td>{group.sex}</td><td>{group.breed}</td><td>{(currentCountsByGroup.get(group.groupId)?.female ?? 0) + (currentCountsByGroup.get(group.groupId)?.male ?? 0)}두</td></tr>) : <tr><td colSpan={6} className={styles.emptySelector}>등록된 그룹이 없습니다. 그룹등록을 먼저 진행해 주세요.</td></tr>}</tbody></table></div><p>총 {selectableGroups.length}개 그룹</p></div> : null}
          </div>

          <div className={styles.formSection}><h3>폐사 정보</h3><div className={styles.formGrid}>
            <Field label="폐사일자" required><input type="date" value={mortalityDate} onChange={(event) => { setMortalityDate(event.target.value); if (selectedGroup) setMortalityAge(String(countValue(selectedGroup.startAge) + daysBetween(selectedGroup.startDate, event.target.value))); }} /></Field>
            <Field label="폐사일령" required><input type="number" min="0" step="1" inputMode="numeric" value={mortalityAge} onChange={(event) => setMortalityAge(event.target.value)} placeholder="일령" /></Field>
            <Field label="폐사원인" required><select value={cause} onChange={(event) => setCause(event.target.value as FatteningMortalityCause)}>{FATTENING_MORTALITY_CAUSES.map((value, index) => <option value={value} key={value}>{index + 1}.{value}</option>)}</select></Field>
            <Field label="두수(암)" required><input type="number" min="0" step="1" inputMode="numeric" value={femaleCount} onChange={(event) => setFemaleCount(event.target.value)} /></Field>
            <Field label="두수(수)" required><input type="number" min="0" step="1" inputMode="numeric" value={maleCount} onChange={(event) => setMaleCount(event.target.value)} /></Field>
            <Field label="두수 합계"><input value={`${totalCount}두`} readOnly /></Field>
            <Field label="총생체중(kg)"><input type="number" min="0" step="0.1" inputMode="decimal" value={totalWeight} onChange={(event) => setTotalWeight(event.target.value)} placeholder="선택 입력" /></Field>
          </div><Field label="비고"><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="폐사 관련 참고사항" rows={3} /></Field></div>
          <div className={styles.formActions}><button type="button" className={styles.resetButton} onClick={resetForm}><RotateCcw size={16} /> 초기화</button><button type="submit" className={styles.saveButton}><Save size={17} /> 저장</button></div>
        </form>

        <section className={styles.listCard}>
          <div className={styles.listHead}><div><h2>폐사기록 리스트</h2><p>폐사 총 {femaleTotal + maleTotal}두 · 암 {femaleTotal}두 · 수 {maleTotal}두</p></div><strong>조회 {filteredRecords.length}건</strong></div>
          <div className={styles.filters}>
            <label><span>폐사일자</span><div className={styles.dateRange}><CalendarDays size={16} /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><i>~</i><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div></label>
            <label className={styles.searchFilter}><span>통합검색</span><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="그룹ID/그룹명, 장소, 비고" /></div></label>
            <label className={styles.sortFilter}><span>폐사원인</span><div><select value={causeFilter} onChange={(event) => setCauseFilter(event.target.value)}><option value="">전체</option>{FATTENING_MORTALITY_CAUSES.map((value) => <option value={value} key={value}>{value}</option>)}</select></div></label>
            <label className={styles.sortFilter}><span>정렬</span><div><select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}><option value="workDate">작업일</option><option value="groupId">그룹ID/그룹명</option><option value="cause">폐사원인</option></select><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)}><option value="desc">내림차순</option><option value="asc">오름차순</option></select></div></label>
            <button type="button" className={styles.filterButton} onClick={() => { setQuery(""); setCauseFilter(""); setFromDate("2026-08-26"); setToDate("2026-09-26"); setSortField("workDate"); setSortDirection("desc"); }}><SlidersHorizontal size={16} /> 초기화</button>
          </div>
          <div className={styles.tableWrap}><table><thead><tr><th className={styles.checkColumn}><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} aria-label="조회된 폐사 기록 전체 선택" /></th><th>그룹ID/그룹명</th><th>폐사일자</th><th>폐사원인</th><th>두수(암/수)</th><th>합계</th><th>총생체중</th><th>폐사일령</th><th>장소</th><th>비고</th></tr></thead><tbody>{filteredRecords.length ? filteredRecords.map((record) => { const female = countValue(record.femaleCount); const male = countValue(record.maleCount); const group = groups.find((item) => item.groupId === record.groupId); return <tr key={record.id} className={selectedRecordIds.has(record.id) ? styles.selectedRow : ""}><td className={styles.checkColumn}><input type="checkbox" checked={selectedRecordIds.has(record.id)} onChange={() => toggleRecord(record.id)} aria-label={`${record.groupId} 폐사 기록 선택`} /></td><td><strong>{record.groupId}</strong></td><td className={styles.cycleDate}>{record.mortalityDate}</td><td><span className={styles.statusBadge}>{record.cause}</span></td><td>{female}/{male}</td><td>{female + male}두</td><td>{record.totalWeight ? `${record.totalWeight} kg` : "-"}</td><td>{record.mortalityAge}일</td><td>{group?.location || "-"}</td><td>{record.note || "-"}</td></tr>; }) : <tr><td className={styles.emptyTable} colSpan={10}>조건에 맞는 폐사 기록이 없습니다.</td></tr>}</tbody></table></div>
          <div className={styles.listFooter}><button type="button" className={styles.deleteButton} disabled={!selectedRecordIds.size} onClick={deleteSelectedRecords}><Trash2 size={15} /> 선택 삭제{selectedRecordIds.size ? ` (${selectedRecordIds.size})` : ""}</button><div className={styles.pagination}><button disabled>이전</button><strong>1</strong><button disabled>다음</button></div></div>
        </section>
      </div>
    </main>
    {notice ? <button className={styles.toast} onClick={() => setNotice("")}><span>{notice}</span><X size={15} /></button> : null}
  </div>;
}
