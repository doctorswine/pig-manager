"use client";

import {
  ArrowLeft, CalendarDays, ChevronDown, CircleHelp, Menu, PiggyBank, RotateCcw,
  Save, Search, SlidersHorizontal, Trash2, Warehouse, X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { defaultFatteningGroupRecords, FatteningGroupRecord, readStoredFatteningGroupRecords } from "../_data/group-records";
import {
  defaultMovementIntakeRecords, MOVEMENT_INTAKE_TYPES, MovementIntakeRecord,
  MovementIntakeType, readStoredMovementIntakeRecords, storeMovementIntakeRecords,
} from "../_data/movement-intake-records";
import {
  defaultFatteningMortalityRecords, FATTENING_MORTALITY_CAUSES, FatteningMortalityCause,
  FatteningMortalityRecord, readStoredFatteningMortalityRecords, storeFatteningMortalityRecords,
} from "../_data/mortality-records";
import {
  defaultFatteningOutboundRecords, FatteningOutboundRecord, OutboundMovementType,
  readStoredFatteningOutboundRecords, SHIPMENT_TYPES, storeFatteningOutboundRecords, TRANSFER_TYPES,
} from "../_data/outbound-records";
import { defaultFatteningGroupClosureRecords, FatteningGroupClosureRecord, readStoredFatteningGroupClosureRecords } from "../_data/closure-records";
import styles from "../../sows/intake/page.module.css";

type ManagementMode = "이동전입" | "폐사기록" | "전출" | "출하";
type SortField = "workDate" | "groupId" | "mode";
type SortDirection = "desc" | "asc";
type FieldProps = { label: string; required?: boolean; help?: string; children: React.ReactNode };
type UnifiedRecord = {
  key: string; id: number; mode: ManagementMode; groupId: string; date: string; detail: string;
  femaleCount: string; maleCount: string; weight: string; age: string; extra: string; note: string;
};

const sections = [
  { label: "그룹등록", href: "/production/fattening-groups/registration" },
  { label: "두수관리", href: "/production/fattening-groups/movement-intake" },
  { label: "그룹종료", href: "/production/fattening-groups/closure" },
];
const modes: ManagementMode[] = ["이동전입", "폐사기록", "전출", "출하"];

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

export default function HeadcountManagementPage({ initialMode = "이동전입" }: { initialMode?: ManagementMode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mode, setMode] = useState<ManagementMode>(initialMode);
  const [groups, setGroups] = useState<FatteningGroupRecord[]>(defaultFatteningGroupRecords);
  const [movements, setMovements] = useState<MovementIntakeRecord[]>(defaultMovementIntakeRecords);
  const [mortalities, setMortalities] = useState<FatteningMortalityRecord[]>(defaultFatteningMortalityRecords);
  const [outbounds, setOutbounds] = useState<FatteningOutboundRecord[]>(defaultFatteningOutboundRecords);
  const [closures, setClosures] = useState<FatteningGroupClosureRecord[]>(defaultFatteningGroupClosureRecords);
  const [selectedGroup, setSelectedGroup] = useState<FatteningGroupRecord | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [groupQuery, setGroupQuery] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [workAge, setWorkAge] = useState("");
  const [movementType, setMovementType] = useState<MovementIntakeType>("이유입식");
  const [mortalityCause, setMortalityCause] = useState<FatteningMortalityCause>("위축");
  const [outboundType, setOutboundType] = useState<OutboundMovementType>("위탁(계열)전출");
  const [femaleCount, setFemaleCount] = useState("0");
  const [maleCount, setMaleCount] = useState("0");
  const [liveWeight, setLiveWeight] = useState("");
  const [carcassWeight, setCarcassWeight] = useState("");
  const [amount, setAmount] = useState("");
  const [partner, setPartner] = useState("");
  const [sourceGroupId, setSourceGroupId] = useState("");
  const [note, setNote] = useState("");
  const [fromDate, setFromDate] = useState("2026-08-26");
  const [toDate, setToDate] = useState("2026-09-26");
  const [modeFilter, setModeFilter] = useState("");
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("workDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setGroups(readStoredFatteningGroupRecords());
    setMovements(readStoredMovementIntakeRecords());
    setMortalities(readStoredFatteningMortalityRecords());
    setOutbounds(readStoredFatteningOutboundRecords());
    setClosures(readStoredFatteningGroupClosureRecords());
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

  const unifiedRecords = useMemo<UnifiedRecord[]>(() => [
    ...movements.map((record) => ({ key: `이동전입:${record.id}`, id: record.id, mode: "이동전입" as const, groupId: record.groupId, date: record.intakeDate, detail: record.movementType, femaleCount: record.femaleCount, maleCount: record.maleCount, weight: record.totalWeight, age: record.intakeAge, extra: record.sourceGroupId, note: record.note })),
    ...mortalities.map((record) => ({ key: `폐사기록:${record.id}`, id: record.id, mode: "폐사기록" as const, groupId: record.groupId, date: record.mortalityDate, detail: record.cause, femaleCount: record.femaleCount, maleCount: record.maleCount, weight: record.totalWeight, age: record.mortalityAge, extra: "", note: record.note })),
    ...outbounds.map((record) => ({ key: `${record.category}:${record.id}`, id: record.id, mode: record.category, groupId: record.groupId, date: record.actionDate, detail: record.movementType, femaleCount: record.femaleCount, maleCount: record.maleCount, weight: record.liveWeight, age: record.actionAge, extra: record.category === "출하" ? `${record.partner}${record.amount ? ` / ${record.amount}원` : ""}` : record.partner, note: record.note })),
  ], [movements, mortalities, outbounds]);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return unifiedRecords.filter((record) => {
      const matchesDate = (!fromDate || record.date >= fromDate) && (!toDate || record.date <= toDate);
      const matchesMode = !modeFilter || record.mode === modeFilter;
      const matchesKeyword = !keyword || `${record.groupId} ${record.detail} ${record.extra} ${record.note}`.toLowerCase().includes(keyword);
      return matchesDate && matchesMode && matchesKeyword;
    }).sort((left, right) => {
      const leftValue = sortField === "workDate" ? left.date : left[sortField];
      const rightValue = sortField === "workDate" ? right.date : right[sortField];
      return leftValue.localeCompare(rightValue, "ko", { numeric: true }) * (sortDirection === "asc" ? 1 : -1);
    });
  }, [fromDate, modeFilter, query, sortDirection, sortField, toDate, unifiedRecords]);

  const closedGroupIds = useMemo(() => new Set(closures.map((record) => record.groupId)), [closures]);
  const selectableGroups = useMemo(() => {
    const keyword = groupQuery.trim().toLowerCase();
    return groups.filter((group) => !closedGroupIds.has(group.groupId) && (!keyword || `${group.groupId} ${group.location} ${group.breed}`.toLowerCase().includes(keyword)));
  }, [closedGroupIds, groupQuery, groups]);
  const selectedCounts = selectedGroup ? currentCountsByGroup.get(selectedGroup.groupId) : undefined;
  const currentFemale = selectedCounts?.female ?? 0;
  const currentMale = selectedCounts?.male ?? 0;
  const inputFemale = countValue(femaleCount);
  const inputMale = countValue(maleCount);
  const groupAge = selectedGroup ? countValue(selectedGroup.startAge) + daysBetween(selectedGroup.startDate, workDate || "2026-09-26") : 0;
  const allFilteredSelected = filteredRecords.length > 0 && filteredRecords.every((record) => selectedKeys.has(record.key));
  const isSubtractMode = mode !== "이동전입";
  const needsSourceGroup = mode === "이동전입" && movementType === "농장내이동";
  const detailOptions = mode === "이동전입" ? MOVEMENT_INTAKE_TYPES : mode === "폐사기록" ? FATTENING_MORTALITY_CAUSES : mode === "전출" ? TRANSFER_TYPES : SHIPMENT_TYPES;

  function switchMode(nextMode: ManagementMode) {
    setMode(nextMode);
    setOutboundType(nextMode === "출하" ? "자돈판매" : "위탁(계열)전출");
    setSourceGroupId(""); setPartner(""); setAmount(""); setCarcassWeight(""); setNotice("");
  }
  function selectGroup(group: FatteningGroupRecord) {
    setSelectedGroup(group); setSelectorOpen(false); setGroupQuery("");
    setWorkAge(String(countValue(group.startAge) + daysBetween(group.startDate, workDate || group.startDate)));
  }
  function handleGroupKey(event: KeyboardEvent<HTMLTableRowElement>, group: FatteningGroupRecord) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectGroup(group); }
  }
  function resetForm() {
    setSelectedGroup(null); setSelectorOpen(false); setGroupQuery(""); setWorkDate(""); setWorkAge("");
    setFemaleCount("0"); setMaleCount("0"); setLiveWeight(""); setCarcassWeight(""); setAmount("");
    setPartner(""); setSourceGroupId(""); setNote("");
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGroup || !workDate || !workAge) { setNotice("그룹, 이동일자, 일령을 입력해 주세요."); return; }
    if (workDate < selectedGroup.startDate) { setNotice("이동일자는 그룹 시작일자보다 빠를 수 없습니다."); return; }
    const age = Number(workAge); const female = Number(femaleCount || 0); const male = Number(maleCount || 0);
    const weight = Number(liveWeight || 0); const carcass = Number(carcassWeight || 0); const money = Number(amount || 0);
    if (!Number.isInteger(age) || age < 0 || !Number.isInteger(female) || female < 0 || !Number.isInteger(male) || male < 0 || (liveWeight && (!Number.isFinite(weight) || weight < 0)) || (carcassWeight && (!Number.isFinite(carcass) || carcass < 0)) || (amount && (!Number.isFinite(money) || money < 0))) {
      setNotice("일령과 두수는 0 이상의 정수, 중량과 금액은 0 이상의 숫자로 입력해 주세요."); return;
    }
    if (female + male < 1) { setNotice("처리 두수는 암·수 합계가 1두 이상이어야 합니다."); return; }
    if (isSubtractMode && (female > currentFemale || male > currentMale)) { setNotice(`${mode} 두수가 그룹의 현재 암·수 두수를 초과합니다.`); return; }
    if (needsSourceGroup && !sourceGroupId) { setNotice("농장내이동은 전출그룹을 선택해 주세요."); return; }
    if (needsSourceGroup) {
      const source = currentCountsByGroup.get(sourceGroupId);
      if (!source || female > source.female || male > source.male) { setNotice("이동두수가 전출그룹의 현재 암·수 두수를 초과합니다."); return; }
    }
    const id = Date.now();
    if (mode === "이동전입") {
      const next = [{ id, groupId: selectedGroup.groupId, intakeDate: workDate, intakeAge: workAge, movementType, femaleCount, maleCount, totalWeight: liveWeight, sourceGroupId: needsSourceGroup ? sourceGroupId : "", note: note.trim() }, ...movements];
      setMovements(next); storeMovementIntakeRecords(next);
    } else if (mode === "폐사기록") {
      const next = [{ id, groupId: selectedGroup.groupId, mortalityDate: workDate, mortalityAge: workAge, cause: mortalityCause, femaleCount, maleCount, totalWeight: liveWeight, note: note.trim() }, ...mortalities];
      setMortalities(next); storeFatteningMortalityRecords(next);
    } else {
      const next: FatteningOutboundRecord[] = [{ id, groupId: selectedGroup.groupId, actionDate: workDate, actionAge: workAge, category: mode, movementType: outboundType, femaleCount, maleCount, liveWeight, carcassWeight: mode === "출하" ? carcassWeight : "", amount: mode === "출하" ? amount : "", partner: partner.trim(), note: note.trim() }, ...outbounds];
      setOutbounds(next); storeFatteningOutboundRecords(next);
    }
    setNotice(`${selectedGroup.groupId} 그룹의 ${mode} ${female + male}두를 등록했습니다.`); resetForm();
  }

  function toggleAll() {
    setSelectedKeys((current) => { const next = new Set(current); if (allFilteredSelected) filteredRecords.forEach((record) => next.delete(record.key)); else filteredRecords.forEach((record) => next.add(record.key)); return next; });
  }
  function deleteSelected() {
    if (!selectedKeys.size) return;
    const nextMovements = movements.filter((record) => !selectedKeys.has(`이동전입:${record.id}`));
    const nextMortalities = mortalities.filter((record) => !selectedKeys.has(`폐사기록:${record.id}`));
    const nextOutbounds = outbounds.filter((record) => !selectedKeys.has(`${record.category}:${record.id}`));
    setMovements(nextMovements); setMortalities(nextMortalities); setOutbounds(nextOutbounds);
    storeMovementIntakeRecords(nextMovements); storeFatteningMortalityRecords(nextMortalities); storeFatteningOutboundRecords(nextOutbounds);
    setNotice(`선택한 두수관리 기록 ${selectedKeys.size}건을 삭제했습니다.`); setSelectedKeys(new Set());
  }

  return <div className={styles.shell}>
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
      <div className={styles.brand}><span><PiggyBank size={21} /></span><strong>피그매니저</strong><button onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기"><X size={19} /></button></div>
      <Link className={styles.backLink} href="/"><ArrowLeft size={17} /> 대시보드</Link>
      <div className={styles.navGroup}><div className={styles.navTitle}><span>생산관리</span><ChevronDown size={15} /></div><div className={styles.navSection}>모돈개체관리</div><Link className={styles.navItem} href="/production/sows/intake"><i />전입관리</Link><Link className={styles.navItem} href="/production/sows/first-estrus"><i />초발정관리</Link><Link className={styles.navItem} href="/production/sows/breeding/mating"><i />번식관리</Link><Link className={styles.navItem} href="/production/sows/backfat"><i />등지방관리</Link><Link className={styles.navItem} href="/production/sows/cull"><i />도폐사관리</Link><div className={styles.navSection}>웅돈개체관리</div><Link className={styles.navItem} href="/production/boars/intake"><i />웅돈 전입관리</Link><Link className={styles.navItem} href="/production/boars/cull"><i />웅돈 도폐사관리</Link><div className={styles.navSection}>비육돈그룹관리</div>{sections.map((section) => section.label === "두수관리" ? <span className={styles.activeNav} key={section.label}><i />{section.label}</span> : <Link className={styles.navItem} href={section.href} key={section.label}><i />{section.label}</Link>)}</div>
    </aside>
    {sidebarOpen ? <button className={styles.scrim} aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /> : null}
    <main className={styles.main}>
      <header className={styles.topbar}><button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button><div><small>현재 농장</small><strong>해솔 번식농장</strong></div><span className={styles.topbarStatus}>브라우저 저장</span></header>
      <div className={styles.content}>
        <section className={styles.heading}><div><p>생산관리 / 비육돈그룹관리</p><h1>비육돈그룹 두수관리</h1><span>이동전입·폐사·전출·출하 기록을 한 화면에서 관리합니다.</span></div><span className={styles.cycleBadge}><Warehouse size={14} /> 총 {unifiedRecords.length}건</span></section>
        <nav className={`${styles.breedingTabs} ${styles.compactTabs}`} aria-label="비육돈그룹관리 하위 메뉴">{sections.map((section) => <Link className={section.label === "두수관리" ? styles.activeBreedingTab : ""} href={section.href} key={section.label}>{section.label}</Link>)}</nav>
        <nav className={`${styles.breedingTabs} ${styles.modeTabs}`} aria-label="두수관리 기록 구분">{modes.map((value) => <button type="button" className={mode === value ? styles.activeBreedingTab : ""} onClick={() => switchMode(value)} key={value}>{value}</button>)}</nav>

        <form className={styles.formCard} onSubmit={submitForm}>
          <div className={styles.cardHead}><div><span className={styles.cardIcon}><Warehouse size={18} /></span><div><h2>{mode} 기록</h2><p>그룹등록에서 만든 그룹을 먼저 선택하세요.</p></div></div><span className={styles.newBadge}>{mode}</span></div>
          <div className={styles.animalSummary}>
            <label className={styles.field}><span className={styles.fieldLabel}>그룹ID/그룹명<b>*</b><CircleHelp size={14} aria-label="그룹등록에서 만든 그룹을 선택합니다." /></span><div className={styles.selectorInput}><Search size={16} /><input value={selectorOpen ? groupQuery : selectedGroup?.groupId ?? ""} onFocus={() => { setSelectorOpen(true); setGroupQuery(selectedGroup?.groupId ?? ""); }} onChange={(event) => setGroupQuery(event.target.value)} placeholder="그룹 검색·선택" autoComplete="off" /><ChevronDown size={16} /></div></label>
            <Field label="입식두수(암/수)"><input value={selectedGroup ? `${selectedGroup.femaleCount}/${selectedGroup.maleCount}` : ""} placeholder="자동 표시" readOnly /></Field>
            <Field label="폐사두수"><input value={selectedGroup ? `${mortalities.filter((record) => record.groupId === selectedGroup.groupId).reduce((sum, record) => sum + countValue(record.femaleCount) + countValue(record.maleCount), 0)}두` : ""} placeholder="자동 표시" readOnly /></Field>
            <Field label="전출두수"><input value={selectedGroup ? `${outbounds.filter((record) => record.groupId === selectedGroup.groupId && record.category === "전출").reduce((sum, record) => sum + countValue(record.femaleCount) + countValue(record.maleCount), 0)}두` : ""} placeholder="자동 표시" readOnly /></Field>
            <Field label="출하두수"><input value={selectedGroup ? `${outbounds.filter((record) => record.groupId === selectedGroup.groupId && record.category === "출하").reduce((sum, record) => sum + countValue(record.femaleCount) + countValue(record.maleCount), 0)}두` : ""} placeholder="자동 표시" readOnly /></Field>
            <Field label="현재두수(암/수)"><input value={selectedGroup ? `${currentFemale}/${currentMale} (${currentFemale + currentMale}두)` : ""} placeholder="자동 표시" readOnly /></Field>
            {selectorOpen ? <div className={styles.sowSelector}><div className={styles.sowSelectorHead}><div><strong>등록 그룹 목록</strong><span>두수를 기록할 그룹을 선택하세요.</span></div><button type="button" onClick={() => setSelectorOpen(false)} aria-label="선택 목록 닫기"><X size={16} /></button></div><div className={styles.sowSelectorTable}><table><thead><tr><th>그룹ID/그룹명</th><th>시작일자</th><th>장소</th><th>품종</th><th>현재두수</th></tr></thead><tbody>{selectableGroups.length ? selectableGroups.map((group) => <tr key={group.id} tabIndex={0} onClick={() => selectGroup(group)} onKeyDown={(event) => handleGroupKey(event, group)}><td><strong>{group.groupId}</strong></td><td>{group.startDate}</td><td>{group.location || "-"}</td><td>{group.breed}</td><td>{(currentCountsByGroup.get(group.groupId)?.female ?? 0) + (currentCountsByGroup.get(group.groupId)?.male ?? 0)}두</td></tr>) : <tr><td colSpan={5} className={styles.emptySelector}>등록된 그룹이 없습니다.</td></tr>}</tbody></table></div></div> : null}
          </div>

          <div className={styles.formSection}><h3>{mode} 정보</h3><div className={styles.formGrid}>
            <Field label="이동일자" required><input type="date" value={workDate} onChange={(event) => { setWorkDate(event.target.value); if (selectedGroup) setWorkAge(String(countValue(selectedGroup.startAge) + daysBetween(selectedGroup.startDate, event.target.value))); }} /></Field>
            <Field label="일령" required><input type="number" min="0" step="1" value={workAge} onChange={(event) => setWorkAge(event.target.value)} /></Field>
            <Field label={mode === "폐사기록" ? "폐사원인" : "이동구분"} required><select value={mode === "이동전입" ? movementType : mode === "폐사기록" ? mortalityCause : outboundType} onChange={(event) => { if (mode === "이동전입") setMovementType(event.target.value as MovementIntakeType); else if (mode === "폐사기록") setMortalityCause(event.target.value as FatteningMortalityCause); else setOutboundType(event.target.value as OutboundMovementType); }}>{detailOptions.map((value, index) => <option value={value} key={value}>{index + 1}.{value}</option>)}</select></Field>
            <Field label="두수(암)" required><input type="number" min="0" step="1" value={femaleCount} onChange={(event) => setFemaleCount(event.target.value)} /></Field>
            <Field label="두수(수)" required><input type="number" min="0" step="1" value={maleCount} onChange={(event) => setMaleCount(event.target.value)} /></Field>
            <Field label="두수 합계"><input value={`${inputFemale + inputMale}두`} readOnly /></Field>
            <Field label="생체중(kg)"><input type="number" min="0" step="0.1" value={liveWeight} onChange={(event) => setLiveWeight(event.target.value)} placeholder="선택 입력" /></Field>
            {needsSourceGroup ? <Field label="전출그룹" required><select value={sourceGroupId} onChange={(event) => setSourceGroupId(event.target.value)}><option value="">선택</option>{groups.filter((group) => group.groupId !== selectedGroup?.groupId && !closedGroupIds.has(group.groupId)).map((group) => <option value={group.groupId} key={group.id}>{group.groupId}</option>)}</select></Field> : null}
            {mode === "전출" ? <Field label="전출처/운송처"><input value={partner} onChange={(event) => setPartner(event.target.value)} placeholder="선택 입력" /></Field> : null}
            {mode === "출하" ? <><Field label="거래처"><input value={partner} onChange={(event) => setPartner(event.target.value)} placeholder="선택 입력" /></Field><Field label="금액"><input type="number" min="0" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="선택 입력" /></Field><Field label="지육체중(kg)"><input type="number" min="0" step="0.1" value={carcassWeight} onChange={(event) => setCarcassWeight(event.target.value)} placeholder="선택 입력" /></Field></> : null}
          </div><Field label="비고"><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} /></Field></div>
          <div className={styles.formActions}><button type="button" className={styles.resetButton} onClick={resetForm}><RotateCcw size={16} /> 초기화</button><button type="submit" className={styles.saveButton}><Save size={17} /> 저장</button></div>
        </form>

        <section className={styles.listCard}>
          <div className={styles.listHead}><div><h2>비육돈그룹 두수기록 리스트</h2><p>이동전입 {movements.length}건 · 폐사 {mortalities.length}건 · 전출 {outbounds.filter((record) => record.category === "전출").length}건 · 출하 {outbounds.filter((record) => record.category === "출하").length}건</p></div><strong>조회 {filteredRecords.length}건</strong></div>
          <div className={styles.filters}>
            <label><span>이동일자</span><div className={styles.dateRange}><CalendarDays size={16} /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><i>~</i><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div></label>
            <label className={styles.sortFilter}><span>이동구분</span><div><select value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}><option value="">전체</option>{modes.map((value) => <option value={value} key={value}>{value}</option>)}</select></div></label>
            <label className={styles.searchFilter}><span>통합검색</span><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="그룹ID, 세부구분, 거래처, 비고" /></div></label>
            <label className={styles.sortFilter}><span>정렬</span><div><select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}><option value="workDate">작업일</option><option value="groupId">그룹ID</option><option value="mode">이동구분</option></select><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)}><option value="desc">내림차순</option><option value="asc">오름차순</option></select></div></label>
            <button type="button" className={styles.filterButton} onClick={() => { setModeFilter(""); setQuery(""); setSortField("workDate"); setSortDirection("desc"); }}><SlidersHorizontal size={16} /> 초기화</button>
          </div>
          <div className={styles.tableWrap}><table><thead><tr><th className={styles.checkColumn}><input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} aria-label="조회 기록 전체 선택" /></th><th>그룹ID</th><th>이동일자</th><th>이동구분</th><th>세부구분</th><th>두수(암/수)</th><th>생체중</th><th>일령</th><th>추가정보</th><th>비고</th></tr></thead><tbody>{filteredRecords.length ? filteredRecords.map((record) => <tr key={record.key} className={selectedKeys.has(record.key) ? styles.selectedRow : ""}><td className={styles.checkColumn}><input type="checkbox" checked={selectedKeys.has(record.key)} onChange={() => setSelectedKeys((current) => { const next = new Set(current); if (next.has(record.key)) next.delete(record.key); else next.add(record.key); return next; })} aria-label={`${record.groupId} ${record.mode} 기록 선택`} /></td><td><strong>{record.groupId}</strong></td><td className={styles.cycleDate}>{record.date}</td><td><span className={styles.statusBadge}>{record.mode}</span></td><td>{record.detail}</td><td>{record.femaleCount}/{record.maleCount}</td><td>{record.weight ? `${record.weight} kg` : "-"}</td><td>{record.age}일</td><td>{record.extra || "-"}</td><td>{record.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={10}>조건에 맞는 두수관리 기록이 없습니다.</td></tr>}</tbody></table></div>
          <div className={styles.listFooter}><button type="button" className={styles.deleteButton} disabled={!selectedKeys.size} onClick={deleteSelected}><Trash2 size={15} /> 선택 삭제{selectedKeys.size ? ` (${selectedKeys.size})` : ""}</button><div className={styles.pagination}><button disabled>이전</button><strong>1</strong><button disabled>다음</button></div></div>
        </section>
      </div>
    </main>
    {notice ? <button className={styles.toast} onClick={() => setNotice("")}><span>{notice}</span><X size={15} /></button> : null}
  </div>;
}
