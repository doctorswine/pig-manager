"use client";

import {
  ArrowLeft, CalendarDays, ChevronDown, CircleHelp, Menu, PiggyBank, RotateCcw,
  Save, Search, SlidersHorizontal, Trash2, Warehouse, X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  defaultFatteningGroupClosureRecords, FatteningGroupClosureRecord,
  readStoredFatteningGroupClosureRecords, storeFatteningGroupClosureRecords,
} from "../_data/closure-records";
import { defaultFatteningGroupRecords, FatteningGroupRecord, readStoredFatteningGroupRecords } from "../_data/group-records";
import { defaultMovementIntakeRecords, MovementIntakeRecord, readStoredMovementIntakeRecords } from "../_data/movement-intake-records";
import { defaultFatteningMortalityRecords, FatteningMortalityRecord, readStoredFatteningMortalityRecords } from "../_data/mortality-records";
import { defaultFatteningOutboundRecords, FatteningOutboundRecord, readStoredFatteningOutboundRecords } from "../_data/outbound-records";
import styles from "../../sows/intake/page.module.css";

type SortField = "closureDate" | "groupId";
type SortDirection = "desc" | "asc";
type FieldProps = { label: string; required?: boolean; help?: string; children: React.ReactNode };

const sections = [
  { label: "그룹등록", href: "/production/fattening-groups/registration" },
  { label: "두수관리", href: "/production/fattening-groups/movement-intake" },
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

export default function GroupClosurePageContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [groups, setGroups] = useState<FatteningGroupRecord[]>(defaultFatteningGroupRecords);
  const [movements, setMovements] = useState<MovementIntakeRecord[]>(defaultMovementIntakeRecords);
  const [mortalities, setMortalities] = useState<FatteningMortalityRecord[]>(defaultFatteningMortalityRecords);
  const [outbounds, setOutbounds] = useState<FatteningOutboundRecord[]>(defaultFatteningOutboundRecords);
  const [records, setRecords] = useState<FatteningGroupClosureRecord[]>(defaultFatteningGroupClosureRecords);
  const [selectedGroup, setSelectedGroup] = useState<FatteningGroupRecord | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [groupQuery, setGroupQuery] = useState("");
  const [closureDate, setClosureDate] = useState("");
  const [note, setNote] = useState("");
  const [fromDate, setFromDate] = useState("2026-08-26");
  const [toDate, setToDate] = useState("2026-09-26");
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("closureDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setGroups(readStoredFatteningGroupRecords());
    setMovements(readStoredMovementIntakeRecords());
    setMortalities(readStoredFatteningMortalityRecords());
    setOutbounds(readStoredFatteningOutboundRecords());
    setRecords(readStoredFatteningGroupClosureRecords());
  }, []);

  const currentCountsByGroup = useMemo(() => {
    const counts = new Map(groups.map((group) => [group.groupId, { female: countValue(group.femaleCount), male: countValue(group.maleCount) }]));
    movements.forEach((record) => {
      const destination = counts.get(record.groupId);
      if (destination) { destination.female += countValue(record.femaleCount); destination.male += countValue(record.maleCount); }
      if (record.sourceGroupId) {
        const source = counts.get(record.sourceGroupId);
        if (source) { source.female -= countValue(record.femaleCount); source.male -= countValue(record.maleCount); }
      }
    });
    mortalities.forEach((record) => {
      const group = counts.get(record.groupId);
      if (group) { group.female -= countValue(record.femaleCount); group.male -= countValue(record.maleCount); }
    });
    outbounds.forEach((record) => {
      const group = counts.get(record.groupId);
      if (group) { group.female -= countValue(record.femaleCount); group.male -= countValue(record.maleCount); }
    });
    return counts;
  }, [groups, movements, mortalities, outbounds]);

  const closedGroupIds = useMemo(() => new Set(records.map((record) => record.groupId)), [records]);
  const selectableGroups = useMemo(() => {
    const keyword = groupQuery.trim().toLowerCase();
    return groups.filter((group) => !closedGroupIds.has(group.groupId) && (!keyword || `${group.groupId} ${group.location} ${group.breed}`.toLowerCase().includes(keyword)));
  }, [closedGroupIds, groupQuery, groups]);
  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => {
      const group = groups.find((item) => item.groupId === record.groupId);
      return (!fromDate || record.closureDate >= fromDate) && (!toDate || record.closureDate <= toDate) && (!keyword || `${record.groupId} ${group?.location ?? ""} ${record.note}`.toLowerCase().includes(keyword));
    }).sort((left, right) => left[sortField].localeCompare(right[sortField], "ko", { numeric: true }) * (sortDirection === "asc" ? 1 : -1));
  }, [fromDate, groups, query, records, sortDirection, sortField, toDate]);

  const selectedCounts = selectedGroup ? currentCountsByGroup.get(selectedGroup.groupId) : undefined;
  const currentFemale = selectedCounts?.female ?? 0;
  const currentMale = selectedCounts?.male ?? 0;
  const initialCount = selectedGroup ? countValue(selectedGroup.femaleCount) + countValue(selectedGroup.maleCount) : 0;
  const mortalityCount = selectedGroup ? mortalities.filter((record) => record.groupId === selectedGroup.groupId).reduce((sum, record) => sum + countValue(record.femaleCount) + countValue(record.maleCount), 0) : 0;
  const transferCount = selectedGroup ? outbounds.filter((record) => record.groupId === selectedGroup.groupId && record.category === "전출").reduce((sum, record) => sum + countValue(record.femaleCount) + countValue(record.maleCount), 0) : 0;
  const shipmentCount = selectedGroup ? outbounds.filter((record) => record.groupId === selectedGroup.groupId && record.category === "출하").reduce((sum, record) => sum + countValue(record.femaleCount) + countValue(record.maleCount), 0) : 0;
  const currentAge = selectedGroup ? countValue(selectedGroup.startAge) + daysBetween(selectedGroup.startDate, closureDate || "2026-09-26") : 0;
  const allSelected = filteredRecords.length > 0 && filteredRecords.every((record) => selectedIds.has(record.id));

  function selectGroup(group: FatteningGroupRecord) { setSelectedGroup(group); setSelectorOpen(false); setGroupQuery(""); }
  function handleGroupKey(event: KeyboardEvent<HTMLTableRowElement>, group: FatteningGroupRecord) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectGroup(group); }
  }
  function resetForm() { setSelectedGroup(null); setSelectorOpen(false); setGroupQuery(""); setClosureDate(""); setNote(""); }
  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGroup || !closureDate) { setNotice("종료할 그룹과 종료일을 입력해 주세요."); return; }
    if (closureDate < selectedGroup.startDate) { setNotice("종료일은 그룹 시작일자보다 빠를 수 없습니다."); return; }
    if (records.some((record) => record.groupId === selectedGroup.groupId)) { setNotice("이미 종료된 그룹입니다."); return; }
    if (currentFemale !== 0 || currentMale !== 0) { setNotice(`현재두수 ${currentFemale}/${currentMale}두가 남아 있어 그룹을 종료할 수 없습니다.`); return; }
    const latestWorkDate = [...movements.filter((record) => record.groupId === selectedGroup.groupId || record.sourceGroupId === selectedGroup.groupId).map((record) => record.intakeDate), ...mortalities.filter((record) => record.groupId === selectedGroup.groupId).map((record) => record.mortalityDate), ...outbounds.filter((record) => record.groupId === selectedGroup.groupId).map((record) => record.actionDate)].sort().at(-1);
    if (latestWorkDate && closureDate < latestWorkDate) { setNotice(`종료일은 마지막 두수 작업일(${latestWorkDate})보다 빠를 수 없습니다.`); return; }
    const next = [{ id: Date.now(), groupId: selectedGroup.groupId, closureDate, note: note.trim() }, ...records];
    setRecords(next); storeFatteningGroupClosureRecords(next); setNotice(`${selectedGroup.groupId} 그룹을 종료했습니다.`); resetForm();
  }
  function deleteSelected() {
    if (!selectedIds.size) return;
    const next = records.filter((record) => !selectedIds.has(record.id));
    setRecords(next); storeFatteningGroupClosureRecords(next); setNotice(`선택한 그룹종료 기록 ${selectedIds.size}건을 삭제했습니다.`); setSelectedIds(new Set());
  }

  return <div className={styles.shell}>
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
      <div className={styles.brand}><span><PiggyBank size={21} /></span><strong>피그매니저</strong><button onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기"><X size={19} /></button></div>
      <Link className={styles.backLink} href="/"><ArrowLeft size={17} /> 대시보드</Link>
      <div className={styles.navGroup}><div className={styles.navTitle}><span>생산관리</span><ChevronDown size={15} /></div><div className={styles.navSection}>모돈개체관리</div><Link className={styles.navItem} href="/production/sows/intake"><i />전입관리</Link><Link className={styles.navItem} href="/production/sows/first-estrus"><i />초발정관리</Link><Link className={styles.navItem} href="/production/sows/breeding/mating"><i />번식관리</Link><Link className={styles.navItem} href="/production/sows/backfat"><i />등지방관리</Link><Link className={styles.navItem} href="/production/sows/cull"><i />도폐사관리</Link><div className={styles.navSection}>웅돈개체관리</div><Link className={styles.navItem} href="/production/boars/intake"><i />웅돈 전입관리</Link><Link className={styles.navItem} href="/production/boars/cull"><i />웅돈 도폐사관리</Link><div className={styles.navSection}>비육돈그룹관리</div>{sections.map((section) => section.label === "그룹종료" ? <span className={styles.activeNav} key={section.label}><i />{section.label}</span> : <Link className={styles.navItem} href={section.href} key={section.label}><i />{section.label}</Link>)}</div>
    </aside>
    {sidebarOpen ? <button className={styles.scrim} aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /> : null}
    <main className={styles.main}>
      <header className={styles.topbar}><button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button><div><small>현재 농장</small><strong>해솔 번식농장</strong></div><span className={styles.topbarStatus}>브라우저 저장</span></header>
      <div className={styles.content}>
        <section className={styles.heading}><div><p>생산관리 / 비육돈그룹관리</p><h1>비육돈그룹 종료</h1><span>모든 두수 작업이 끝난 그룹을 종료합니다.</span></div><span className={styles.cycleBadge}><Warehouse size={14} /> 종료 {records.length}개 그룹</span></section>
        <nav className={`${styles.breedingTabs} ${styles.compactTabs}`} aria-label="비육돈그룹관리 하위 메뉴">{sections.map((section) => <Link className={section.label === "그룹종료" ? styles.activeBreedingTab : ""} href={section.href} key={section.label}>{section.label}</Link>)}</nav>
        <form className={styles.formCard} onSubmit={submitForm}>
          <div className={styles.cardHead}><div><span className={styles.cardIcon}><Warehouse size={18} /></span><div><h2>그룹종료 관리</h2><p>현재 암·수 두수가 모두 0인 그룹만 종료할 수 있습니다.</p></div></div><span className={styles.newBadge}>신규종료</span></div>
          <div className={styles.animalSummary}>
            <label className={styles.field}><span className={styles.fieldLabel}>그룹ID/그룹명<b>*</b><CircleHelp size={14} aria-label="종료되지 않은 그룹만 선택할 수 있습니다." /></span><div className={styles.selectorInput}><Search size={16} /><input value={selectorOpen ? groupQuery : selectedGroup?.groupId ?? ""} onFocus={() => { setSelectorOpen(true); setGroupQuery(selectedGroup?.groupId ?? ""); }} onChange={(event) => setGroupQuery(event.target.value)} placeholder="그룹 검색·선택" autoComplete="off" /><ChevronDown size={16} /></div></label>
            <Field label="현재일령"><input value={selectedGroup ? `${currentAge}일` : ""} placeholder="종료일 기준 자동 계산" readOnly /></Field>
            <Field label="입식두수"><input value={selectedGroup ? `${initialCount}두` : ""} placeholder="자동 표시" readOnly /></Field>
            <Field label="폐사두수"><input value={selectedGroup ? `${mortalityCount}두` : ""} placeholder="자동 표시" readOnly /></Field>
            <Field label="전출/출하두수"><input value={selectedGroup ? `${transferCount}/${shipmentCount}두` : ""} placeholder="전출/출하" readOnly /></Field>
            <Field label="현재두수(암/수)"><input value={selectedGroup ? `${currentFemale}/${currentMale} (${currentFemale + currentMale}두)` : ""} placeholder="자동 표시" readOnly /></Field>
            {selectorOpen ? <div className={styles.sowSelector}><div className={styles.sowSelectorHead}><div><strong>종료 가능 그룹 목록</strong><span>종료되지 않은 그룹을 선택하세요.</span></div><button type="button" onClick={() => setSelectorOpen(false)} aria-label="선택 목록 닫기"><X size={16} /></button></div><div className={styles.sowSelectorTable}><table><thead><tr><th>그룹ID</th><th>시작일자</th><th>장소</th><th>현재두수(암/수)</th></tr></thead><tbody>{selectableGroups.length ? selectableGroups.map((group) => { const counts = currentCountsByGroup.get(group.groupId); return <tr key={group.id} tabIndex={0} onClick={() => selectGroup(group)} onKeyDown={(event) => handleGroupKey(event, group)}><td><strong>{group.groupId}</strong></td><td>{group.startDate}</td><td>{group.location || "-"}</td><td>{counts?.female ?? 0}/{counts?.male ?? 0}</td></tr>; }) : <tr><td colSpan={4} className={styles.emptySelector}>종료할 수 있는 등록 그룹이 없습니다.</td></tr>}</tbody></table></div></div> : null}
          </div>
          <div className={styles.formSection}><h3>종료 정보</h3><div className={styles.formGrid}><Field label="종료일" required><input type="date" value={closureDate} onChange={(event) => setClosureDate(event.target.value)} /></Field></div><Field label="비고"><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} /></Field></div>
          <div className={styles.formActions}><button type="button" className={styles.resetButton} onClick={resetForm}><RotateCcw size={16} /> 초기화</button><button type="submit" className={styles.saveButton}><Save size={17} /> 저장</button></div>
        </form>
        <section className={styles.listCard}>
          <div className={styles.listHead}><div><h2>그룹종료 기록 리스트</h2><p>종료된 비육돈 그룹을 조회하고 잘못된 기록을 삭제할 수 있습니다.</p></div><strong>조회 {filteredRecords.length}건</strong></div>
          <div className={styles.filters}><label><span>종료일</span><div className={styles.dateRange}><CalendarDays size={16} /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><i>~</i><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div></label><label className={styles.searchFilter}><span>통합검색</span><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="그룹ID, 장소, 비고" /></div></label><label className={styles.sortFilter}><span>정렬</span><div><select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}><option value="closureDate">종료일</option><option value="groupId">그룹ID</option></select><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)}><option value="desc">내림차순</option><option value="asc">오름차순</option></select></div></label><button type="button" className={styles.filterButton} onClick={() => { setQuery(""); setSortField("closureDate"); setSortDirection("desc"); }}><SlidersHorizontal size={16} /> 초기화</button></div>
          <div className={styles.tableWrap}><table><thead><tr><th className={styles.checkColumn}><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds((current) => { const next = new Set(current); if (allSelected) filteredRecords.forEach((record) => next.delete(record.id)); else filteredRecords.forEach((record) => next.add(record.id)); return next; })} aria-label="조회된 그룹종료 기록 전체 선택" /></th><th>그룹ID</th><th>그룹종료일</th><th>시작일자</th><th>장소</th><th>비고</th></tr></thead><tbody>{filteredRecords.length ? filteredRecords.map((record) => { const group = groups.find((item) => item.groupId === record.groupId); return <tr key={record.id} className={selectedIds.has(record.id) ? styles.selectedRow : ""}><td className={styles.checkColumn}><input type="checkbox" checked={selectedIds.has(record.id)} onChange={() => setSelectedIds((current) => { const next = new Set(current); if (next.has(record.id)) next.delete(record.id); else next.add(record.id); return next; })} aria-label={`${record.groupId} 그룹종료 기록 선택`} /></td><td><strong>{record.groupId}</strong></td><td className={styles.cycleDate}>{record.closureDate}</td><td>{group?.startDate || "-"}</td><td>{group?.location || "-"}</td><td>{record.note || "-"}</td></tr>; }) : <tr><td className={styles.emptyTable} colSpan={6}>조건에 맞는 그룹종료 기록이 없습니다.</td></tr>}</tbody></table></div>
          <div className={styles.listFooter}><button type="button" className={styles.deleteButton} disabled={!selectedIds.size} onClick={deleteSelected}><Trash2 size={15} /> 선택 삭제{selectedIds.size ? ` (${selectedIds.size})` : ""}</button><div className={styles.pagination}><button disabled>이전</button><strong>1</strong><button disabled>다음</button></div></div>
        </section>
      </div>
    </main>
    {notice ? <button className={styles.toast} onClick={() => setNotice("")}><span>{notice}</span><X size={15} /></button> : null}
  </div>;
}
