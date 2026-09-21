"use client";

import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  HeartPulse,
  Menu,
  PiggyBank,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { defaultIntakeRecords, readStoredIntakeRecords, SowIntakeRecord } from "../_data/intake-records";
import styles from "../intake/page.module.css";

type CycleEntry = {
  heatDate: string;
  weight: string;
  backfat: string;
  intensity: string;
  note: string;
};

type EstrusRecord = {
  id: number;
  animalNo: string;
  earTag: string;
  breed: string;
  cycles: CycleEntry[];
};

type AnimalForm = {
  animalNo: string;
  earTag: string;
  breed: string;
};
type SortField = "workDate" | "animalNo" | "earTag";
type SortDirection = "desc" | "asc";

const blankCycle = (): CycleEntry => ({ heatDate: "", weight: "", backfat: "", intensity: "정상발정", note: "" });
const blankCycles = () => Array.from({ length: 4 }, blankCycle);

const sampleRecords: EstrusRecord[] = [
  {
    id: 1,
    animalNo: "2931",
    earTag: "6508",
    breed: "F1",
    cycles: [
      { heatDate: "2026-08-26", weight: "112", backfat: "13.2", intensity: "정상발정", note: "발정 반응 양호" },
      { heatDate: "2026-09-16", weight: "118", backfat: "13.8", intensity: "정상발정", note: "" },
      blankCycle(),
      blankCycle(),
    ],
  },
  {
    id: 2,
    animalNo: "2932",
    earTag: "6644",
    breed: "F1",
    cycles: [
      { heatDate: "2026-09-02", weight: "110", backfat: "12.6", intensity: "미약발정", note: "초발정 확인" },
      blankCycle(),
      blankCycle(),
      blankCycle(),
    ],
  },
  {
    id: 3,
    animalNo: "2938",
    earTag: "66135",
    breed: "F1",
    cycles: [
      { heatDate: "2026-08-30", weight: "115", backfat: "13.5", intensity: "정상발정", note: "" },
      { heatDate: "2026-09-19", weight: "121", backfat: "14.1", intensity: "이상발정", note: "2차 확인" },
      blankCycle(),
      blankCycle(),
    ],
  },
];

type FieldProps = {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
};

function Field({ label, required, help, children }: FieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}{required ? <b>*</b> : null}{help ? <CircleHelp size={14} aria-label={help} /> : null}</span>
      {children}
    </label>
  );
}

function average(cycles: CycleEntry[], field: "weight" | "backfat") {
  const values = cycles.map((cycle) => Number(cycle[field])).filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return "-";
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
}

function latestIntensity(cycles: CycleEntry[]) {
  return [...cycles].reverse().find((cycle) => cycle.heatDate)?.intensity ?? "-";
}

function latestHeatDate(cycles: CycleEntry[]) {
  return cycles.reduce((latest, cycle) => cycle.heatDate > latest ? cycle.heatDate : latest, "");
}

export default function FirstEstrusPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeCycle, setActiveCycle] = useState(0);
  const [animal, setAnimal] = useState<AnimalForm>({ animalNo: "", earTag: "", breed: "F1" });
  const [cycles, setCycles] = useState<CycleEntry[]>(blankCycles);
  const [records, setRecords] = useState(sampleRecords);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(() => new Set());
  const [intakeRecords, setIntakeRecords] = useState<SowIntakeRecord[]>(defaultIntakeRecords);
  const [selectorField, setSelectorField] = useState<"animalNo" | "earTag" | null>(null);
  const [sowQuery, setSowQuery] = useState("");
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("workDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [fromDate, setFromDate] = useState("2026-08-19");
  const [toDate, setToDate] = useState("2026-09-19");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setIntakeRecords(readStoredIntakeRecords());
  }, []);

  const selectableSows = useMemo(() => {
    const keyword = sowQuery.trim().toLowerCase();
    if (!keyword) return intakeRecords;
    return intakeRecords.filter((sow) => `${sow.animalNo} ${sow.earTag} ${sow.breed} ${sow.status}`.toLowerCase().includes(keyword));
  }, [intakeRecords, sowQuery]);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesKeyword = !keyword || `${record.animalNo} ${record.earTag} ${record.breed}`.toLowerCase().includes(keyword);
      const matchesDate = record.cycles.some((cycle) => cycle.heatDate && cycle.heatDate >= fromDate && cycle.heatDate <= toDate);
      return matchesKeyword && matchesDate;
    }).sort((left, right) => {
      const leftValue = sortField === "workDate" ? latestHeatDate(left.cycles) : left[sortField];
      const rightValue = sortField === "workDate" ? latestHeatDate(right.cycles) : right[sortField];
      return leftValue.localeCompare(rightValue, "ko", { numeric: true }) * (sortDirection === "asc" ? 1 : -1);
    });
  }, [fromDate, query, records, sortDirection, sortField, toDate]);
  const allFilteredSelected = filteredRecords.length > 0 && filteredRecords.every((record) => selectedRecordIds.has(record.id));

  function updateCycle(field: keyof CycleEntry, value: string) {
    setCycles((current) => current.map((cycle, index) => index === activeCycle ? { ...cycle, [field]: value } : cycle));
  }

  function toggleRecord(recordId: number) {
    setSelectedRecordIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
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
    setRecords((current) => current.filter((record) => !selectedRecordIds.has(record.id)));
    setSelectedRecordIds(new Set());
    setNotice(`선택한 초발정 기록 ${deletedCount}건을 삭제했습니다.`);
  }

  function resetForm() {
    setAnimal({ animalNo: "", earTag: "", breed: "F1" });
    setCycles(blankCycles());
    setActiveCycle(0);
  }

  function openSowSelector(field: "animalNo" | "earTag") {
    setSelectorField(field);
    setSowQuery(animal[field]);
  }

  function selectSow(sow: SowIntakeRecord) {
    setAnimal({ animalNo: sow.animalNo, earTag: sow.earTag, breed: sow.breed });
    setSelectorField(null);
    setSowQuery("");
  }

  function handleSowRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, sow: SowIntakeRecord) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectSow(sow);
    }
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!animal.animalNo || !cycles[activeCycle].heatDate) {
      setNotice("모돈번호와 발정일을 입력해 주세요.");
      return;
    }

    setRecords((current) => {
      const existing = current.find((record) => record.animalNo === animal.animalNo);
      if (existing) {
        return current.map((record) => record.id === existing.id ? { ...record, earTag: animal.earTag, breed: animal.breed, cycles } : record);
      }
      return [{ id: Date.now(), ...animal, cycles }, ...current];
    });
    setNotice(`${animal.animalNo}번 모돈의 ${activeCycle + 1}차 초발정을 저장했습니다.`);
  }

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}><span><PiggyBank size={21} /></span><strong>피그매니저</strong><button onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기"><X size={19} /></button></div>
        <Link className={styles.backLink} href="/"><ArrowLeft size={17} /> 대시보드</Link>
        <div className={styles.navGroup}>
          <div className={styles.navTitle}><span>생산관리</span><ChevronDown size={15} /></div>
          <div className={styles.navSection}>모돈개체관리</div>
          <Link className={styles.navItem} href="/production/sows/intake"><i />전입관리</Link>
          <span className={styles.activeNav}><i />초발정관리</span>
          <Link className={styles.navItem} href="/production/sows/breeding/mating"><i />번식관리</Link>
          {['등지방관리', '도폐사관리'].map((item) => (
            <button key={item} onClick={() => setNotice(`${item}는 다음 단계에서 구성합니다.`)}><i />{item}</button>
          ))}
        </div>
      </aside>
      {sidebarOpen ? <button className={styles.scrim} aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /> : null}

      <main className={styles.main}>
        <header className={styles.topbar}>
          <button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button>
          <div><small>현재 농장</small><strong>해솔 번식농장</strong></div>
          <span className={styles.topbarStatus}>예시 데이터</span>
        </header>

        <div className={styles.content}>
          <section className={styles.heading}>
            <div><p>생산관리 / 모돈개체관리</p><h1>초발정관리</h1><span>후보돈의 1차부터 4차까지 발정 기록과 체형 변화를 관리합니다.</span></div>
            <span className={styles.cycleBadge}><HeartPulse size={14} /> 최대 4차 기록</span>
          </section>

          <form className={styles.formCard} onSubmit={submitForm}>
            <div className={styles.cardHead}>
              <div><span className={styles.cardIcon}><HeartPulse size={18} /></span><div><h2>초발정 기록</h2><p><b>*</b> 표시는 필수 입력 항목입니다.</p></div></div>
              <span className={styles.newBadge}>신규등록</span>
            </div>

            <div className={styles.animalSummary}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>모돈번호<b>*</b><CircleHelp size={14} aria-label="전입 기록에서 초발정을 기록할 모돈을 선택합니다." /></span>
                <div className={styles.selectorInput}><Search size={16} /><input value={selectorField === "animalNo" ? sowQuery : animal.animalNo} onFocus={() => openSowSelector("animalNo")} onChange={(event) => setSowQuery(event.target.value)} placeholder="모돈번호 검색·선택" autoComplete="off" /><ChevronDown size={16} /></div>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>이각번호</span>
                <div className={styles.selectorInput}><Search size={16} /><input value={selectorField === "earTag" ? sowQuery : animal.earTag} onFocus={() => openSowSelector("earTag")} onChange={(event) => setSowQuery(event.target.value)} placeholder="이각번호 검색·선택" autoComplete="off" /><ChevronDown size={16} /></div>
              </label>
              {selectorField ? (
                <div className={styles.sowSelector} aria-label="전입 모돈 선택 목록">
                  <div className={styles.sowSelectorHead}><div><strong>전입 개체 목록</strong><span>모돈번호 또는 이각번호로 검색해 선택하세요.</span></div><button type="button" onClick={() => setSelectorField(null)} aria-label="선택 목록 닫기"><X size={16} /></button></div>
                  <div className={styles.sowSelectorTable}>
                    <table>
                      <thead><tr><th>모돈번호</th><th>이각번호</th><th>품종</th><th>출생일</th><th>전입일</th><th>시작상태</th><th>산차</th></tr></thead>
                      <tbody>
                        {selectableSows.length ? selectableSows.map((sow) => (
                          <tr key={sow.id} tabIndex={0} onClick={() => selectSow(sow)} onKeyDown={(event) => handleSowRowKeyDown(event, sow)}>
                            <td><strong>{sow.animalNo}</strong></td><td>{sow.earTag || "-"}</td><td>{sow.breed}</td><td>{sow.birthDate}</td><td>{sow.intakeDate}</td><td><span className={styles.statusBadge}>{sow.status}</span></td><td>{sow.parity || "0"}산</td>
                          </tr>
                        )) : <tr><td colSpan={7} className={styles.emptySelector}>검색 결과가 없습니다.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <p>총 {selectableSows.length}두 · 전입관리에서 등록한 개체만 표시됩니다.</p>
                </div>
              ) : null}
              <Field label="품종">
                <select value={animal.breed} onChange={(event) => setAnimal((current) => ({ ...current, breed: event.target.value }))}>
                  <option value="F1">1.F1</option><option value="YY">2.YY</option><option value="LY">3.LY</option><option value="F2">4.F2</option><option value="YL">5.YL</option><option value="LL">6.LL</option><option value="DD">7.DD</option><option value="기타">8.기타</option>
                </select>
              </Field>
            </div>

            <div className={styles.cycleSection}>
              <h3>초발정 차수</h3>
              <div className={styles.cycleTabs} role="tablist" aria-label="초발정 차수">
                {[0, 1, 2, 3].map((cycleIndex) => (
                  <button type="button" role="tab" aria-selected={activeCycle === cycleIndex} className={activeCycle === cycleIndex ? styles.activeCycle : ""} key={cycleIndex} onClick={() => setActiveCycle(cycleIndex)}>{cycleIndex + 1}차</button>
                ))}
              </div>
              <p className={styles.cycleHint}>{activeCycle + 1}차 초발정 정보를 입력합니다. 시간과 장소는 기록하지 않습니다.</p>
              <div className={styles.cycleGrid}>
                <Field label="발정일" required><input type="date" value={cycles[activeCycle].heatDate} onChange={(event) => updateCycle("heatDate", event.target.value)} /></Field>
                <Field label="체중(kg)"><input type="number" min="0" step="0.1" inputMode="decimal" value={cycles[activeCycle].weight} onChange={(event) => updateCycle("weight", event.target.value)} placeholder="0.0" /></Field>
                <Field label="등지방(mm)"><input type="number" min="0" step="0.1" inputMode="decimal" value={cycles[activeCycle].backfat} onChange={(event) => updateCycle("backfat", event.target.value)} placeholder="0.0" /></Field>
                <Field label="발정강도">
                  <select value={cycles[activeCycle].intensity} onChange={(event) => updateCycle("intensity", event.target.value)}>
                    <option value="정상발정">1.정상발정</option>
                    <option value="미약발정">2.미약발정</option>
                    <option value="이상발정">3.이상발정</option>
                    <option value="잦은거부">4.잦은거부</option>
                  </select>
                </Field>
                <Field label="비고"><input value={cycles[activeCycle].note} onChange={(event) => updateCycle("note", event.target.value)} placeholder="발정 상태 및 참고사항" /></Field>
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="button" className={styles.resetButton} onClick={resetForm}><RotateCcw size={16} /> 초기화</button>
              <button type="submit" className={styles.saveButton}><Save size={17} /> {activeCycle + 1}차 저장</button>
            </div>
          </form>

          <section className={styles.listCard}>
            <div className={styles.listHead}>
              <div><h2>초발정 기록 리스트</h2><p>모돈별 1차부터 4차까지의 발정일을 한눈에 확인합니다.</p></div>
              <strong>총 {filteredRecords.length}두</strong>
            </div>
            <div className={styles.filters}>
              <label><span>발정일</span><div className={styles.dateRange}><CalendarDays size={16} /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><i>~</i><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div></label>
              <label className={styles.searchFilter}><span>통합검색</span><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="모돈번호, 이각번호, 품종" /></div></label>
              <label className={styles.sortFilter}><span>정렬</span><div><select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)} aria-label="초발정 기록 정렬 기준"><option value="workDate">작업일</option><option value="animalNo">모돈번호</option><option value="earTag">이각번호</option></select><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)} aria-label="초발정 기록 정렬 방향"><option value="desc">내림차순</option><option value="asc">오름차순</option></select></div></label>
              <button className={styles.filterButton} onClick={() => { setQuery(""); setFromDate("2026-08-19"); setToDate("2026-09-19"); setSortField("workDate"); setSortDirection("desc"); }}><SlidersHorizontal size={16} /> 초기화</button>
            </div>

            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th className={styles.checkColumn}><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} aria-label="조회된 초발정 기록 전체 선택" /></th><th>모돈번호</th><th>이각번호</th><th>품종</th><th>1차 발정일</th><th>2차 발정일</th><th>3차 발정일</th><th>4차 발정일</th><th>최근 발정강도</th><th>평균 체중</th><th>평균 등지방</th></tr></thead>
                <tbody>
                  {filteredRecords.length ? filteredRecords.map((record) => {
                    const averageWeight = average(record.cycles, "weight");
                    const averageBackfat = average(record.cycles, "backfat");
                    return (
                      <tr key={record.id} className={selectedRecordIds.has(record.id) ? styles.selectedRow : ""}>
                        <td className={styles.checkColumn}><input type="checkbox" checked={selectedRecordIds.has(record.id)} onChange={() => toggleRecord(record.id)} aria-label={`${record.animalNo}번 초발정 기록 선택`} /></td>
                        <td><strong>{record.animalNo}</strong></td><td>{record.earTag || "-"}</td><td>{record.breed}</td>
                        {record.cycles.map((cycle, index) => <td className={cycle.heatDate ? styles.cycleDate : ""} key={index}>{cycle.heatDate || "-"}</td>)}
                        <td><span className={styles.statusBadge}>{latestIntensity(record.cycles)}</span></td>
                        <td className={styles.averageValue}>{averageWeight === "-" ? "-" : `${averageWeight} kg`}</td>
                        <td className={styles.averageValue}>{averageBackfat === "-" ? "-" : `${averageBackfat} mm`}</td>
                      </tr>
                    );
                  }) : <tr><td className={styles.emptyTable} colSpan={11}>조건에 맞는 초발정 기록이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className={styles.listFooter}>
              <button type="button" className={styles.deleteButton} disabled={!selectedRecordIds.size} onClick={deleteSelectedRecords}><Trash2 size={15} /> 선택 삭제{selectedRecordIds.size ? ` (${selectedRecordIds.size})` : ""}</button>
              <div className={styles.pagination}><button disabled>이전</button><strong>1</strong><button disabled>다음</button></div>
            </div>
          </section>
        </div>
      </main>
      {notice ? <button className={styles.toast} onClick={() => setNotice("")}><span>{notice}</span><X size={15} /></button> : null}
    </div>
  );
}
