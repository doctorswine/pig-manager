"use client";

import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Menu,
  PiggyBank,
  RotateCcw,
  Save,
  Search,
  Skull,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { BoarIntakeRecord, defaultBoarIntakeRecords, readStoredBoarIntakeRecords } from "../_data/intake-records";
import {
  BOAR_CULL_CAUSES,
  BOAR_CULL_TYPES,
  BoarCullCause,
  BoarCullRecord,
  BoarCullType,
  defaultBoarCullRecords,
  readStoredBoarCullRecords,
  storeBoarCullRecords,
} from "../_data/cull-records";
import styles from "../../sows/intake/page.module.css";

type SortField = "workDate" | "animalNo" | "earTag";
type SortDirection = "desc" | "asc";
type FieldProps = { label: string; required?: boolean; help?: string; children: React.ReactNode };

function Field({ label, required, help, children }: FieldProps) {
  return <label className={styles.field}><span className={styles.fieldLabel}>{label}{required ? <b>*</b> : null}{help ? <CircleHelp size={14} aria-label={help} /> : null}</span>{children}</label>;
}

function formatAmount(amount: string) {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0 ? `${value.toLocaleString("ko-KR")}원` : "-";
}

function formatAge(birthDate: string, referenceDate?: string) {
  if (!birthDate) return "-";
  const birth = new Date(`${birthDate}T00:00:00`);
  const reference = referenceDate ? new Date(`${referenceDate}T00:00:00`) : new Date();
  if (Number.isNaN(birth.getTime()) || reference < birth) return "-";
  let months = (reference.getFullYear() - birth.getFullYear()) * 12 + reference.getMonth() - birth.getMonth();
  if (reference.getDate() < birth.getDate()) months -= 1;
  return `${Math.floor(months / 12)}년 ${months % 12}개월`;
}

export default function BoarCullPageContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [intakeRecords, setIntakeRecords] = useState<BoarIntakeRecord[]>(defaultBoarIntakeRecords);
  const [records, setRecords] = useState<BoarCullRecord[]>(defaultBoarCullRecords);
  const [selectedBoar, setSelectedBoar] = useState<BoarIntakeRecord | null>(null);
  const [selectorField, setSelectorField] = useState<"animalNo" | "earTag" | null>(null);
  const [boarQuery, setBoarQuery] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [type, setType] = useState<BoarCullType>("도태");
  const [cause, setCause] = useState<BoarCullCause>("고령/노산");
  const [weight, setWeight] = useState("");
  const [buyer, setBuyer] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("2026-08-26");
  const [toDate, setToDate] = useState("2026-09-26");
  const [sortField, setSortField] = useState<SortField>("workDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(() => new Set());
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setIntakeRecords(readStoredBoarIntakeRecords());
    setRecords(readStoredBoarCullRecords());
  }, []);

  const selectableBoars = useMemo(() => {
    const keyword = boarQuery.trim().toLowerCase();
    if (!keyword) return intakeRecords;
    return intakeRecords.filter((boar) => `${boar.animalNo} ${boar.earTag} ${boar.breed} ${boar.boarType}`.toLowerCase().includes(keyword));
  }, [boarQuery, intakeRecords]);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesKeyword = !keyword || `${record.animalNo} ${record.earTag} ${record.breed} ${record.boarType} ${record.type} ${record.cause} ${record.buyer} ${record.note}`.toLowerCase().includes(keyword);
      const matchesDate = (!fromDate || record.eventDate >= fromDate) && (!toDate || record.eventDate <= toDate);
      return matchesKeyword && matchesDate;
    }).sort((left, right) => {
      const leftValue = sortField === "workDate" ? left.eventDate : left[sortField];
      const rightValue = sortField === "workDate" ? right.eventDate : right[sortField];
      return leftValue.localeCompare(rightValue, "ko", { numeric: true }) * (sortDirection === "asc" ? 1 : -1);
    });
  }, [fromDate, query, records, sortDirection, sortField, toDate]);

  const allFilteredSelected = filteredRecords.length > 0 && filteredRecords.every((record) => selectedRecordIds.has(record.id));
  const typeSummary = BOAR_CULL_TYPES.map((value) => `${value} ${records.filter((record) => record.type === value).length}`).join(" · ");

  function openBoarSelector(field: "animalNo" | "earTag") {
    setSelectorField(field);
    setBoarQuery(selectedBoar?.[field] ?? "");
  }

  function selectBoar(boar: BoarIntakeRecord) {
    setSelectedBoar(boar);
    setSelectorField(null);
    setBoarQuery("");
  }

  function handleBoarRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, boar: BoarIntakeRecord) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectBoar(boar);
    }
  }

  function resetForm() {
    setSelectedBoar(null);
    setSelectorField(null);
    setBoarQuery("");
    setEventDate("");
    setType("도태");
    setCause("고령/노산");
    setWeight("");
    setBuyer("");
    setSaleAmount("");
    setNote("");
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBoar || !eventDate) {
      setNotice("웅돈과 도폐사일을 입력해 주세요.");
      return;
    }
    const weightValue = Number(weight);
    const amountValue = Number(saleAmount);
    if ((weight && (!Number.isFinite(weightValue) || weightValue < 0)) || (saleAmount && (!Number.isFinite(amountValue) || amountValue < 0))) {
      setNotice("체중과 판매금액은 0 이상의 숫자로 입력해 주세요.");
      return;
    }
    if (records.some((record) => record.animalNo === selectedBoar.animalNo)) {
      setNotice("이미 도폐사 기록이 있는 웅돈입니다.");
      return;
    }

    const nextRecord: BoarCullRecord = {
      id: Date.now(),
      animalNo: selectedBoar.animalNo,
      earTag: selectedBoar.earTag,
      breed: selectedBoar.breed,
      boarType: selectedBoar.boarType,
      previousStatus: "보유",
      eventDate,
      type,
      cause,
      weight,
      buyer: buyer.trim(),
      saleAmount,
      note: note.trim(),
    };
    const nextRecords = [nextRecord, ...records];
    setRecords(nextRecords);
    storeBoarCullRecords(nextRecords);
    setNotice(`${selectedBoar.animalNo}번 웅돈의 ${type} 기록을 저장했습니다.`);
    resetForm();
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
    storeBoarCullRecords(nextRecords);
    setSelectedRecordIds(new Set());
    setNotice(`선택한 웅돈 도폐사 기록 ${deletedCount}건을 삭제했습니다.`);
  }

  return <div className={styles.shell}>
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
      <div className={styles.brand}><span><PiggyBank size={21} /></span><strong>피그매니저</strong><button onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기"><X size={19} /></button></div>
      <Link className={styles.backLink} href="/"><ArrowLeft size={17} /> 대시보드</Link>
      <div className={styles.navGroup}>
        <div className={styles.navTitle}><span>생산관리</span><ChevronDown size={15} /></div>
        <div className={styles.navSection}>모돈개체관리</div>
        <Link className={styles.navItem} href="/production/sows/intake"><i />전입관리</Link>
        <Link className={styles.navItem} href="/production/sows/first-estrus"><i />초발정관리</Link>
        <Link className={styles.navItem} href="/production/sows/breeding/mating"><i />번식관리</Link>
        <Link className={styles.navItem} href="/production/sows/backfat"><i />등지방관리</Link>
        <Link className={styles.navItem} href="/production/sows/cull"><i />도폐사관리</Link>
        <div className={styles.navSection}>웅돈개체관리</div>
        <Link className={styles.navItem} href="/production/boars/intake"><i />웅돈 전입관리</Link>
        <span className={styles.activeNav}><i />웅돈 도폐사관리</span>
      </div>
    </aside>
    {sidebarOpen ? <button className={styles.scrim} aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /> : null}

    <main className={styles.main}>
      <header className={styles.topbar}><button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button><div><small>현재 농장</small><strong>해솔 번식농장</strong></div><span className={styles.topbarStatus}>브라우저 저장</span></header>
      <div className={styles.content}>
        <section className={styles.heading}><div><p>생산관리 / 웅돈개체관리</p><h1>웅돈 도폐사관리</h1><span>웅돈의 도태·폐사·전출·판매 기록을 관리합니다.</span></div><span className={styles.cycleBadge}><Skull size={14} /> 총 {records.length}건</span></section>

        <nav className={styles.breedingTabs} style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }} aria-label="웅돈개체관리 하위 메뉴">
          <Link href="/production/boars/intake">웅돈 전입관리</Link><Link className={styles.activeBreedingTab} href="/production/boars/cull">웅돈 도폐사관리</Link>
        </nav>

        <form className={styles.formCard} onSubmit={submitForm}>
          <div className={styles.cardHead}><div><span className={styles.cardIcon}><Skull size={18} /></span><div><h2>웅돈 도폐사 기록</h2><p><b>*</b> 표시는 필수 입력 항목입니다.</p></div></div><span className={styles.newBadge}>신규등록</span></div>
          <div className={styles.animalSummary}>
            <label className={styles.field}><span className={styles.fieldLabel}>웅돈번호<b>*</b><CircleHelp size={14} aria-label="웅돈 전입관리에서 등록한 웅돈을 선택합니다." /></span><div className={styles.selectorInput}><Search size={16} /><input value={selectorField === "animalNo" ? boarQuery : selectedBoar?.animalNo ?? ""} onFocus={() => openBoarSelector("animalNo")} onChange={(event) => setBoarQuery(event.target.value)} placeholder="웅돈번호 검색·선택" autoComplete="off" /><ChevronDown size={16} /></div></label>
            <label className={styles.field}><span className={styles.fieldLabel}>이각번호</span><div className={styles.selectorInput}><Search size={16} /><input value={selectorField === "earTag" ? boarQuery : selectedBoar?.earTag ?? ""} onFocus={() => openBoarSelector("earTag")} onChange={(event) => setBoarQuery(event.target.value)} placeholder="이각번호 검색·선택" autoComplete="off" /><ChevronDown size={16} /></div></label>
            <Field label="품종"><input value={selectedBoar?.breed ?? ""} placeholder="웅돈 선택 시 자동 표시" readOnly /></Field>
            <Field label="전입일"><input value={selectedBoar?.intakeDate ?? ""} placeholder="웅돈 선택 시 자동 표시" readOnly /></Field>
            <Field label="웅돈구분"><input value={selectedBoar?.boarType ?? ""} placeholder="웅돈 선택 시 자동 표시" readOnly /></Field>
            <Field label="연령"><input value={selectedBoar ? formatAge(selectedBoar.birthDate, eventDate || undefined) : ""} placeholder="웅돈 선택 시 자동 표시" readOnly /></Field>
            {selectorField ? <div className={styles.sowSelector} aria-label="전입 웅돈 선택 목록"><div className={styles.sowSelectorHead}><div><strong>전입 개체 목록</strong><span>도폐사 기록을 등록할 웅돈을 선택하세요.</span></div><button type="button" onClick={() => setSelectorField(null)} aria-label="선택 목록 닫기"><X size={16} /></button></div><div className={styles.sowSelectorTable}><table><thead><tr><th>웅돈번호</th><th>이각번호</th><th>품종</th><th>전입일</th><th>웅돈구분</th><th>연령</th></tr></thead><tbody>{selectableBoars.length ? selectableBoars.map((boar) => <tr key={boar.id} tabIndex={0} onClick={() => selectBoar(boar)} onKeyDown={(event) => handleBoarRowKeyDown(event, boar)}><td><strong>{boar.animalNo}</strong></td><td>{boar.earTag || "-"}</td><td>{boar.breed}</td><td>{boar.intakeDate}</td><td><span className={styles.statusBadge}>{boar.boarType}</span></td><td>{formatAge(boar.birthDate)}</td></tr>) : <tr><td colSpan={6} className={styles.emptySelector}>검색 결과가 없습니다.</td></tr>}</tbody></table></div><p>총 {selectableBoars.length}두 · 웅돈 전입관리에서 등록한 개체만 표시됩니다.</p></div> : null}
          </div>

          <div className={styles.formSection}><h3>도폐사 정보</h3><div className={styles.formGrid}>
            <Field label="도폐사일" required help="도태·폐사·전출·판매가 발생한 날짜를 선택합니다."><input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></Field>
            <Field label="도폐사 구분" required><select value={type} onChange={(event) => setType(event.target.value as BoarCullType)}>{BOAR_CULL_TYPES.map((value, index) => <option value={value} key={value}>{index + 1}.{value}</option>)}</select></Field>
            <Field label="도폐사 원인" required><select value={cause} onChange={(event) => setCause(event.target.value as BoarCullCause)}>{BOAR_CULL_CAUSES.map((value, index) => <option value={value} key={value}>{index + 1}.{value}</option>)}</select></Field>
            <Field label="체중(kg)"><input type="number" min="0" step="0.1" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="0.0" /></Field>
            <Field label="판매처/전출처"><input value={buyer} onChange={(event) => setBuyer(event.target.value)} placeholder="판매처 또는 전출처 입력" /></Field>
            <Field label="판매금액(원)" help="입력하지 않아도 저장할 수 있습니다."><input type="number" min="0" step="1" inputMode="numeric" value={saleAmount} onChange={(event) => setSaleAmount(event.target.value)} placeholder="선택 입력" /></Field>
            <Field label="이전상태"><input value={selectedBoar ? "보유" : ""} placeholder="웅돈 선택 시 자동 표시" readOnly /></Field>
            <Field label="웅돈구분"><input value={selectedBoar?.boarType ?? ""} placeholder="웅돈 선택 시 자동 표시" readOnly /></Field>
            <Field label="비고"><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="도폐사 관련 참고사항" /></Field>
          </div></div>
          <div className={styles.formActions}><button type="button" className={styles.resetButton} onClick={resetForm}><RotateCcw size={16} /> 초기화</button><button type="submit" className={styles.saveButton}><Save size={17} /> 저장</button></div>
        </form>

        <section className={styles.listCard}>
          <div className={styles.listHead}><div><h2>웅돈 도폐사 기록 리스트</h2><p>{typeSummary}</p></div><strong>총 {filteredRecords.length}건</strong></div>
          <div className={styles.filters}>
            <label><span>도폐사일</span><div className={styles.dateRange}><CalendarDays size={16} /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><i>~</i><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div></label>
            <label className={styles.searchFilter}><span>통합검색</span><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="웅돈번호, 이각번호, 구분, 원인" /></div></label>
            <label className={styles.sortFilter}><span>정렬</span><div><select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)} aria-label="웅돈 도폐사 기록 정렬 기준"><option value="workDate">작업일</option><option value="animalNo">웅돈번호</option><option value="earTag">이각번호</option></select><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)} aria-label="웅돈 도폐사 기록 정렬 방향"><option value="desc">내림차순</option><option value="asc">오름차순</option></select></div></label>
            <button type="button" className={styles.filterButton} onClick={() => { setQuery(""); setFromDate("2026-08-26"); setToDate("2026-09-26"); setSortField("workDate"); setSortDirection("desc"); }}><SlidersHorizontal size={16} /> 초기화</button>
          </div>
          <div className={styles.tableWrap}><table><thead><tr><th className={styles.checkColumn}><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} aria-label="조회된 웅돈 도폐사 기록 전체 선택" /></th><th>웅돈번호</th><th>이각번호</th><th>품종</th><th>웅돈구분</th><th>도폐사일</th><th>구분</th><th>원인</th><th>체중</th><th>판매처/전출처</th><th>판매금액</th><th>비고</th></tr></thead><tbody>{filteredRecords.length ? filteredRecords.map((record) => <tr key={record.id} className={selectedRecordIds.has(record.id) ? styles.selectedRow : ""}><td className={styles.checkColumn}><input type="checkbox" checked={selectedRecordIds.has(record.id)} onChange={() => toggleRecord(record.id)} aria-label={`${record.animalNo}번 웅돈 도폐사 기록 선택`} /></td><td><strong>{record.animalNo}</strong></td><td>{record.earTag || "-"}</td><td>{record.breed}</td><td>{record.boarType}</td><td className={styles.cycleDate}>{record.eventDate}</td><td><span className={styles.statusBadge}>{record.type}</span></td><td>{record.cause}</td><td>{record.weight ? `${record.weight} kg` : "-"}</td><td>{record.buyer || "-"}</td><td>{formatAmount(record.saleAmount)}</td><td>{record.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={12}>조건에 맞는 웅돈 도폐사 기록이 없습니다.</td></tr>}</tbody></table></div>
          <div className={styles.listFooter}><button type="button" className={styles.deleteButton} disabled={!selectedRecordIds.size} onClick={deleteSelectedRecords}><Trash2 size={15} /> 선택 삭제{selectedRecordIds.size ? ` (${selectedRecordIds.size})` : ""}</button><div className={styles.pagination}><button disabled>이전</button><strong>1</strong><button disabled>다음</button></div></div>
        </section>
      </div>
    </main>
    {notice ? <button className={styles.toast} onClick={() => setNotice("")}><span>{notice}</span><X size={15} /></button> : null}
  </div>;
}
