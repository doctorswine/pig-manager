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
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { defaultIntakeRecords, readStoredIntakeRecords, SowIntakeRecord } from "../../_data/intake-records";
import { defaultMatingRecords, MatingRecord, readStoredMatingRecords } from "../../_data/mating-records";
import { defaultPregnancyIncidentRecords, PregnancyIncidentRecord, readStoredPregnancyIncidentRecords, writeStoredPregnancyIncidentRecords } from "../../_data/pregnancy-incident-records";
import styles from "../../intake/page.module.css";

type IncidentForm = Omit<PregnancyIncidentRecord, "id">;
type SortField = "workDate" | "animalNo" | "earTag";
type SortDirection = "desc" | "asc";

const emptyForm: IncidentForm = {
  animalNo: "",
  earTag: "",
  breed: "F1",
  parity: "0",
  matingDate: "",
  incidentDate: "",
  cause: "재발",
  diagnosisLocation: "",
  note: "",
};

const incidentCauses = ["재발", "불임", "유산", "공태", "폐사", "도태"];


type FieldProps = { label: string; required?: boolean; help?: string; children: React.ReactNode };

function Field({ label, required, help, children }: FieldProps) {
  return <label className={styles.field}><span className={styles.fieldLabel}>{label}{required ? <b>*</b> : null}{help ? <CircleHelp size={14} aria-label={help} /> : null}</span>{children}</label>;
}

function elapsedDays(fromDate: string, toDate: string) {
  if (!fromDate || !toDate) return "-";
  const start = Date.parse(`${fromDate}T00:00:00Z`);
  const end = Date.parse(`${toDate}T00:00:00Z`);
  return `${Math.max(0, Math.floor((end - start) / 86400000))}일`;
}

export default function PregnancyIncidentPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState<IncidentForm>(emptyForm);
  const [records, setRecords] = useState<PregnancyIncidentRecord[]>(defaultPregnancyIncidentRecords);
  const [intakeRecords, setIntakeRecords] = useState<SowIntakeRecord[]>(defaultIntakeRecords);
  const [matingRecords, setMatingRecords] = useState<MatingRecord[]>(defaultMatingRecords);
  const [selectorField, setSelectorField] = useState<"animalNo" | "earTag" | null>(null);
  const [sowQuery, setSowQuery] = useState("");
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("workDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [fromDate, setFromDate] = useState("2026-08-19");
  const [toDate, setToDate] = useState("2026-09-19");
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(() => new Set());
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setIntakeRecords(readStoredIntakeRecords());
    setMatingRecords(readStoredMatingRecords());
    setRecords(readStoredPregnancyIncidentRecords());
  }, []);

  const selectableSows = useMemo(() => {
    const keyword = sowQuery.trim().toLowerCase();
    if (!keyword) return intakeRecords;
    return intakeRecords.filter((sow) => `${sow.animalNo} ${sow.earTag} ${sow.breed} ${sow.status}`.toLowerCase().includes(keyword));
  }, [intakeRecords, sowQuery]);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesKeyword = !keyword || `${record.animalNo} ${record.earTag} ${record.cause}`.toLowerCase().includes(keyword);
      return matchesKeyword && record.incidentDate >= fromDate && record.incidentDate <= toDate;
    }).sort((left, right) => {
      const leftValue = sortField === "workDate" ? left.incidentDate : left[sortField];
      const rightValue = sortField === "workDate" ? right.incidentDate : right[sortField];
      return leftValue.localeCompare(rightValue, "ko", { numeric: true }) * (sortDirection === "asc" ? 1 : -1);
    });
  }, [fromDate, query, records, sortDirection, sortField, toDate]);

  const allFilteredSelected = filteredRecords.length > 0 && filteredRecords.every((record) => selectedRecordIds.has(record.id));
  const selectedSow = intakeRecords.find((sow) => sow.animalNo === form.animalNo);

  function updateField(field: keyof IncidentForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openSowSelector(field: "animalNo" | "earTag") {
    setSelectorField(field);
    setSowQuery(form[field]);
  }

  function selectSow(sow: SowIntakeRecord) {
    const latestMating = matingRecords
      .filter((record) => record.animalNo === sow.animalNo || (sow.earTag && record.earTag === sow.earTag))
      .sort((left, right) => right.matingDate.localeCompare(left.matingDate))[0];
    setForm((current) => ({ ...current, animalNo: sow.animalNo, earTag: sow.earTag, breed: sow.breed, parity: sow.parity || "0", matingDate: latestMating?.matingDate || "" }));
    if (!latestMating) setNotice(`${sow.animalNo}번 모돈의 교배 기록이 없습니다. 먼저 교배 기록을 등록해 주세요.`);
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
    if (!form.animalNo || !form.incidentDate || !form.cause) {
      setNotice("모돈번호, 사고일, 임신사고원인을 입력해 주세요.");
      return;
    }
    setRecords((current) => {
      const next = [{ id: Date.now(), ...form }, ...current];
      writeStoredPregnancyIncidentRecords(next);
      return next;
    });
    setNotice(`${form.animalNo}번 모돈의 임신사고 기록을 저장했습니다.`);
    setForm(emptyForm);
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
    setRecords((current) => {
      const next = current.filter((record) => !selectedRecordIds.has(record.id));
      writeStoredPregnancyIncidentRecords(next);
      return next;
    });
    setSelectedRecordIds(new Set());
    setNotice(`선택한 임신사고 기록 ${deletedCount}건을 삭제했습니다.`);
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
          <Link className={styles.navItem} href="/production/sows/first-estrus"><i />초발정관리</Link>
          <span className={styles.activeNav}><i />번식관리</span>
          <Link className={styles.navItem} href="/production/sows/backfat"><i />등지방관리</Link><Link className={styles.navItem} href="/production/sows/cull"><i />도폐사관리</Link>
        </div>
      </aside>
      {sidebarOpen ? <button className={styles.scrim} aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /> : null}

      <main className={styles.main}>
        <header className={styles.topbar}>
          <button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button>
          <div><small>현재 농장</small><strong>해솔 번식농장</strong></div><span className={styles.topbarStatus}>예시 데이터</span>
        </header>

        <div className={styles.content}>
          <section className={styles.heading}><div><p>생산관리 / 모돈개체관리</p><h1>번식관리</h1><span>교배부터 이유까지 모돈의 번식 기록을 단계별로 관리합니다.</span></div></section>

          <nav className={styles.breedingTabs} aria-label="번식관리 기록 구분">
            <Link href="/production/sows/breeding/mating">교배</Link>
            <Link className={styles.activeBreedingTab} href="/production/sows/breeding/pregnancy-incident">임신사고</Link>
            <Link href="/production/sows/breeding/farrowing">분만</Link>
            <Link href="/production/sows/breeding/nursing-piglets">포유자돈</Link>
            <Link href="/production/sows/breeding/weaning">이유</Link>
          </nav>

          <section className={styles.infoStrip} aria-label="선택 모돈 정보">
            <div><span>모돈번호</span><strong>{form.animalNo || "선택 전"}</strong></div><div><span>이각번호</span><strong>{form.earTag || "-"}</strong></div><div><span>품종</span><strong>{form.breed}</strong></div><div><span>산차</span><strong>{form.parity}산</strong></div><div><span>현재상태</span><strong>{selectedSow?.status || "-"}</strong></div><div><span>최종작업</span><strong>{form.matingDate ? "교배" : "-"}</strong></div>
          </section>

          <form className={styles.formCard} onSubmit={submitForm}>
            <div className={styles.cardHead}><div><span className={styles.cardIcon}><TriangleAlert size={18} /></span><div><h2>임신사고 기록 입력</h2><p><b>*</b> 표시는 필수 입력 항목입니다.</p></div></div><span className={styles.newBadge}>임신사고</span></div>

            <div className={styles.formSection}>
              <h3>모돈 정보</h3>
              <div className={styles.formGrid}>
                <label className={styles.field}><span className={styles.fieldLabel}>모돈번호<b>*</b><CircleHelp size={14} aria-label="전입 기록에서 임신사고를 기록할 모돈을 선택합니다." /></span><div className={styles.selectorInput}><Search size={16} /><input value={selectorField === "animalNo" ? sowQuery : form.animalNo} onFocus={() => openSowSelector("animalNo")} onChange={(event) => setSowQuery(event.target.value)} placeholder="모돈번호 검색·선택" autoComplete="off" /><ChevronDown size={16} /></div></label>
                <label className={styles.field}><span className={styles.fieldLabel}>이각번호</span><div className={styles.selectorInput}><Search size={16} /><input value={selectorField === "earTag" ? sowQuery : form.earTag} onFocus={() => openSowSelector("earTag")} onChange={(event) => setSowQuery(event.target.value)} placeholder="이각번호 검색·선택" autoComplete="off" /><ChevronDown size={16} /></div></label>
                {selectorField ? <div className={styles.sowSelector} aria-label="전입 모돈 선택 목록"><div className={styles.sowSelectorHead}><div><strong>전입 개체 목록</strong><span>모돈번호 또는 이각번호로 검색해 선택하세요.</span></div><button type="button" onClick={() => setSelectorField(null)} aria-label="선택 목록 닫기"><X size={16} /></button></div><div className={styles.sowSelectorTable}><table><thead><tr><th>모돈번호</th><th>이각번호</th><th>품종</th><th>출생일</th><th>전입일</th><th>시작상태</th><th>산차</th></tr></thead><tbody>{selectableSows.length ? selectableSows.map((sow) => <tr key={sow.id} tabIndex={0} onClick={() => selectSow(sow)} onKeyDown={(event) => handleSowRowKeyDown(event, sow)}><td><strong>{sow.animalNo}</strong></td><td>{sow.earTag || "-"}</td><td>{sow.breed}</td><td>{sow.birthDate}</td><td>{sow.intakeDate}</td><td><span className={styles.statusBadge}>{sow.status}</span></td><td>{sow.parity || "0"}산</td></tr>) : <tr><td colSpan={7} className={styles.emptySelector}>검색 결과가 없습니다.</td></tr>}</tbody></table></div><p>총 {selectableSows.length}두 · 전입관리에서 등록한 개체만 표시됩니다.</p></div> : null}
                <Field label="품종"><select value={form.breed} onChange={(event) => updateField("breed", event.target.value)}><option value="F1">1.F1</option><option value="YY">2.YY</option><option value="LY">3.LY</option><option value="F2">4.F2</option><option value="YL">5.YL</option><option value="LL">6.LL</option><option value="DD">7.DD</option><option value="기타">8.기타</option></select></Field>
                <Field label="산차"><input type="number" min="0" value={form.parity} onChange={(event) => updateField("parity", event.target.value)} /></Field>
              </div>
            </div>

            <div className={styles.formSection}>
              <h3>임신사고 정보</h3>
              <div className={styles.formGrid}>
                <Field label="교배일(자동)" help="선택한 모돈의 가장 최근 교배일을 자동으로 불러옵니다."><span className={styles.calculatedField}>{form.matingDate || "교배 기록 없음"}</span></Field>
                <Field label="사고일" required><input type="date" value={form.incidentDate} onChange={(event) => updateField("incidentDate", event.target.value)} /></Field>
                <Field label="경과일"><span className={styles.calculatedField}>{elapsedDays(form.matingDate, form.incidentDate)}</span></Field>
                <Field label="임신사고원인" required><select value={form.cause} onChange={(event) => updateField("cause", event.target.value)}>{incidentCauses.map((cause, index) => <option key={cause} value={cause}>{index + 1}.{cause}</option>)}</select></Field>
                <Field label="진단 장소"><input value={form.diagnosisLocation} onChange={(event) => updateField("diagnosisLocation", event.target.value)} placeholder="돈사·돈방 입력" /></Field>
              </div>
              <Field label="비고"><textarea rows={3} value={form.note} onChange={(event) => updateField("note", event.target.value)} placeholder="임신사고 관련 참고사항을 입력하세요." /></Field>
            </div>
            <div className={styles.formActions}><button type="button" className={styles.resetButton} onClick={() => setForm(emptyForm)}><RotateCcw size={16} /> 초기화</button><button type="submit" className={styles.saveButton}><Save size={17} /> 저장</button></div>
          </form>

          <section className={styles.listCard}>
            <div className={styles.listHead}><div><h2>임신사고 기록 내역</h2><p>등록된 임신사고 기록을 날짜와 모돈번호로 조회합니다.</p></div><strong>총 {filteredRecords.length}건</strong></div>
            <div className={styles.filters}><label><span>사고일</span><div className={styles.dateRange}><CalendarDays size={16} /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><i>~</i><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div></label><label className={styles.searchFilter}><span>통합검색</span><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="모돈번호, 이각번호, 사고원인" /></div></label><label className={styles.sortFilter}><span>정렬</span><div><select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)} aria-label="임신사고 기록 정렬 기준"><option value="workDate">작업일</option><option value="animalNo">모돈번호</option><option value="earTag">이각번호</option></select><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)} aria-label="임신사고 기록 정렬 방향"><option value="desc">내림차순</option><option value="asc">오름차순</option></select></div></label><button className={styles.filterButton} onClick={() => { setQuery(""); setFromDate("2026-08-19"); setToDate("2026-09-19"); setSortField("workDate"); setSortDirection("desc"); }}><SlidersHorizontal size={16} /> 초기화</button></div>
            <div className={styles.tableWrap}><table><thead><tr><th className={styles.checkColumn}><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} aria-label="조회된 임신사고 기록 전체 선택" /></th><th>모돈번호</th><th>이각번호</th><th>산차</th><th>교배일</th><th>사고일</th><th>경과일</th><th>사고원인</th><th>진단 장소</th><th>비고</th></tr></thead><tbody>{filteredRecords.length ? filteredRecords.map((record) => <tr key={record.id} className={selectedRecordIds.has(record.id) ? styles.selectedRow : ""}><td className={styles.checkColumn}><input type="checkbox" checked={selectedRecordIds.has(record.id)} onChange={() => toggleRecord(record.id)} aria-label={`${record.animalNo}번 임신사고 기록 선택`} /></td><td><strong>{record.animalNo}</strong></td><td>{record.earTag || "-"}</td><td>{record.parity}산</td><td>{record.matingDate || "-"}</td><td>{record.incidentDate}</td><td>{elapsedDays(record.matingDate, record.incidentDate)}</td><td><span className={styles.statusBadge}>{record.cause}</span></td><td>{record.diagnosisLocation || "-"}</td><td>{record.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={10}>조건에 맞는 임신사고 기록이 없습니다.</td></tr>}</tbody></table></div>
            <div className={styles.listFooter}><button type="button" className={styles.deleteButton} disabled={!selectedRecordIds.size} onClick={deleteSelectedRecords}><Trash2 size={15} /> 선택 삭제{selectedRecordIds.size ? ` (${selectedRecordIds.size})` : ""}</button><div className={styles.pagination}><button disabled>이전</button><strong>1</strong><button disabled>다음</button></div></div>
          </section>
        </div>
      </main>
      {notice ? <button className={styles.toast} onClick={() => setNotice("")}><span>{notice}</span><X size={15} /></button> : null}
    </div>
  );
}
