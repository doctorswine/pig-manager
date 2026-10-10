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
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BOAR_INTAKE_RECORDS_STORAGE_KEY,
  BoarIntakeRecord,
  defaultBoarIntakeRecords,
  readStoredBoarIntakeRecords,
} from "../_data/intake-records";
import styles from "../../sows/intake/page.module.css";

type FormState = Omit<BoarIntakeRecord, "id">;
type SortField = "workDate" | "animalNo" | "earTag";
type SortDirection = "desc" | "asc";

const emptyForm: FormState = {
  animalNo: "",
  earTag: "",
  electronicTag: "",
  breed: "F1",
  birthDate: "",
  intakeDate: "",
  boarType: "자연교배",
  source: "",
  serviceStartDate: "",
  bloodlineNo: "",
  pedigreeDegree: "",
  sireNo: "",
  sireBloodlineNo: "",
  damNo: "",
  damBloodlineNo: "",
  weight: "",
  pss: "",
  note: "",
};

type FieldProps = {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
};

function Field({ label, required, help, children }: FieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}{required ? <b>*</b> : null}
        {help ? <CircleHelp size={14} aria-label={help} /> : null}
      </span>
      {children}
    </label>
  );
}

export default function BoarIntakePageContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [records, setRecords] = useState(defaultBoarIntakeRecords);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("workDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [fromDate, setFromDate] = useState("2026-06-26");
  const [toDate, setToDate] = useState("2026-09-26");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setRecords(readStoredBoarIntakeRecords());
    setRecordsLoaded(true);
  }, []);

  useEffect(() => {
    if (recordsLoaded) window.localStorage.setItem(BOAR_INTAKE_RECORDS_STORAGE_KEY, JSON.stringify(records));
  }, [records, recordsLoaded]);

  const identifiers = useMemo(() => ({
    animalNos: new Set(records.map((record) => record.animalNo.trim().toLowerCase()).filter(Boolean)),
    earTags: new Set(records.map((record) => record.earTag.trim().toLowerCase()).filter(Boolean)),
  }), [records]);
  const animalNoDuplicate = Boolean(form.animalNo.trim()) && identifiers.animalNos.has(form.animalNo.trim().toLowerCase());
  const earTagDuplicate = Boolean(form.earTag.trim()) && identifiers.earTags.has(form.earTag.trim().toLowerCase());

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => {
      const haystack = `${record.animalNo} ${record.earTag} ${record.electronicTag} ${record.breed} ${record.boarType} ${record.source}`.toLowerCase();
      return (!keyword || haystack.includes(keyword)) && record.intakeDate >= fromDate && record.intakeDate <= toDate;
    }).sort((left, right) => {
      const leftValue = sortField === "workDate" ? left.intakeDate : left[sortField];
      const rightValue = sortField === "workDate" ? right.intakeDate : right[sortField];
      return leftValue.localeCompare(rightValue, "ko", { numeric: true }) * (sortDirection === "asc" ? 1 : -1);
    });
  }, [fromDate, query, records, sortDirection, sortField, toDate]);

  const allFilteredSelected = filteredRecords.length > 0 && filteredRecords.every((record) => selectedRecordIds.has(record.id));

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.animalNo.trim() || !form.birthDate || !form.intakeDate || !form.boarType) {
      setNotice("웅돈번호, 출생일, 전입일, 웅돈구분을 입력해 주세요.");
      return;
    }
    if (animalNoDuplicate || earTagDuplicate) {
      const duplicateFields = [animalNoDuplicate ? "웅돈번호" : "", earTagDuplicate ? "이각번호" : ""].filter(Boolean).join("와 ");
      setNotice(`${duplicateFields}가 기존 전입 기록과 중복됩니다. 번호를 확인해 주세요.`);
      return;
    }
    setRecords((current) => [{ id: Date.now(), ...form }, ...current]);
    setNotice(`${form.animalNo}번 웅돈을 전입 목록에 추가했습니다.`);
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
    setRecords((current) => current.filter((record) => !selectedRecordIds.has(record.id)));
    setSelectedRecordIds(new Set());
    setNotice(`선택한 웅돈 전입 기록 ${deletedCount}건을 삭제했습니다.`);
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
          <Link className={styles.navItem} href="/production/sows/breeding/mating"><i />번식관리</Link>
          <Link className={styles.navItem} href="/production/sows/backfat"><i />등지방관리</Link>
          <Link className={styles.navItem} href="/production/sows/cull"><i />도폐사관리</Link>
          <div className={styles.navSection}>웅돈개체관리</div>
          <span className={styles.activeNav}><i />웅돈 전입관리</span>
          <Link className={styles.navItem} href="/production/boars/cull"><i />웅돈 도폐사관리</Link>
        </div>
      </aside>
      {sidebarOpen ? <button className={styles.scrim} aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /> : null}

      <main className={styles.main}>
        <header className={styles.topbar}>
          <button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button>
          <div><small>현재 농장</small><strong>해솔 번식농장</strong></div>
          <span className={styles.topbarStatus}>브라우저 저장</span>
        </header>

        <div className={styles.content}>
          <section className={styles.heading}>
            <div><p>생산관리 / 웅돈개체관리</p><h1>웅돈 전입관리</h1><span>새로 들어온 웅돈의 기본정보와 전입 이력을 관리합니다.</span></div>
          </section>

          <nav className={styles.breedingTabs} style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }} aria-label="웅돈개체관리 하위 메뉴">
            <Link className={styles.activeBreedingTab} href="/production/boars/intake">웅돈 전입관리</Link>
            <Link href="/production/boars/cull">웅돈 도폐사관리</Link>
          </nav>

          <form className={styles.formCard} onSubmit={submitForm}>
            <div className={styles.cardHead}>
              <div><span className={styles.cardIcon}><Plus size={18} /></span><div><h2>웅돈 전입 등록</h2><p><b>*</b> 표시는 필수 입력 항목입니다.</p></div></div>
              <span className={styles.newBadge}>신규등록</span>
            </div>

            <div className={styles.formSection}>
              <h3>전입 정보</h3>
              <div className={styles.formGrid}>
                <label className={`${styles.field} ${animalNoDuplicate ? styles.duplicateField : ""}`}>
                  <span className={styles.fieldLabel}>웅돈번호<b>*</b><CircleHelp size={14} aria-label="농장에서 사용하는 고유 웅돈번호입니다." /></span>
                  <input value={form.animalNo} onChange={(event) => updateField("animalNo", event.target.value)} placeholder="웅돈번호 입력" aria-invalid={animalNoDuplicate} />
                  {animalNoDuplicate ? <small className={styles.duplicateMessage}>이미 등록된 웅돈번호입니다.</small> : null}
                </label>
                <label className={`${styles.field} ${earTagDuplicate ? styles.duplicateField : ""}`}>
                  <span className={styles.fieldLabel}>이각번호</span>
                  <input value={form.earTag} onChange={(event) => updateField("earTag", event.target.value)} placeholder="이각번호 입력" aria-invalid={earTagDuplicate} />
                  {earTagDuplicate ? <small className={styles.duplicateMessage}>이미 등록된 이각번호입니다.</small> : null}
                </label>
                <Field label="품종" required>
                  <select value={form.breed} onChange={(event) => updateField("breed", event.target.value)}>
                    <option value="F1">1.F1</option><option value="YY">2.YY</option><option value="LY">3.LY</option><option value="F2">4.F2</option>
                    <option value="YL">5.YL</option><option value="LL">6.LL</option><option value="DD">7.DD</option><option value="기타">8.기타</option>
                  </select>
                </Field>
                <Field label="출생일" required><input type="date" value={form.birthDate} onChange={(event) => updateField("birthDate", event.target.value)} /></Field>
                <Field label="전입일" required><input type="date" value={form.intakeDate} onChange={(event) => updateField("intakeDate", event.target.value)} /></Field>
                <Field label="웅돈구분" required help="웅돈의 교배·정액 이용 형태를 선택합니다.">
                  <select value={form.boarType} onChange={(event) => updateField("boarType", event.target.value)}>
                    <option value="자연교배">1.자연교배</option><option value="자가인공">2.자가인공</option><option value="구입정액">3.구입정액</option>
                  </select>
                </Field>
                <Field label="구입처"><input value={form.source} onChange={(event) => updateField("source", event.target.value)} placeholder="구입처 입력" /></Field>
                <Field label="종모편입일"><input type="date" value={form.serviceStartDate} onChange={(event) => updateField("serviceStartDate", event.target.value)} /></Field>
                <Field label="전입체중(kg)"><input inputMode="decimal" value={form.weight} onChange={(event) => updateField("weight", event.target.value)} placeholder="0" /></Field>
                <Field label="혈통번호"><input value={form.bloodlineNo} onChange={(event) => updateField("bloodlineNo", event.target.value)} placeholder="혈통번호 입력" /></Field>
                <Field label="가계도"><select value={form.pedigreeDegree} onChange={(event) => updateField("pedigreeDegree", event.target.value)}><option value="">선택</option><option value="1대">1대</option><option value="2대">2대</option><option value="3대">3대</option></select></Field>
                <Field label="부돈번호"><input value={form.sireNo} onChange={(event) => updateField("sireNo", event.target.value)} placeholder="부돈번호 입력" /></Field>
                <Field label="부돈 혈통번호"><input value={form.sireBloodlineNo} onChange={(event) => updateField("sireBloodlineNo", event.target.value)} placeholder="부돈 혈통번호 입력" /></Field>
                <Field label="모돈 개체번호"><input value={form.damNo} onChange={(event) => updateField("damNo", event.target.value)} placeholder="모돈 개체번호 입력" /></Field>
                <Field label="모돈 혈통번호"><input value={form.damBloodlineNo} onChange={(event) => updateField("damBloodlineNo", event.target.value)} placeholder="모돈 혈통번호 입력" /></Field>
                <Field label="전자이표번호"><input value={form.electronicTag} onChange={(event) => updateField("electronicTag", event.target.value)} placeholder="전자이표번호 입력" /></Field>
                <Field label="PSS"><select value={form.pss} onChange={(event) => updateField("pss", event.target.value)}><option value="">선택</option><option value="음성">음성</option><option value="양성">양성</option><option value="미검사">미검사</option></select></Field>
              </div>
              <Field label="비고"><textarea value={form.note} onChange={(event) => updateField("note", event.target.value)} placeholder="전입 시 참고사항을 입력하세요." rows={3} /></Field>
            </div>

            <div className={styles.formActions}>
              <button type="button" className={styles.resetButton} onClick={() => setForm(emptyForm)}><RotateCcw size={16} /> 초기화</button>
              <button type="submit" className={styles.saveButton}><Save size={17} /> 저장</button>
            </div>
          </form>

          <section className={styles.listCard}>
            <div className={styles.listHead}>
              <div><h2>웅돈 전입 이력</h2><p>등록된 전입 내역을 날짜와 웅돈번호로 조회합니다.</p></div>
              <strong>총 {filteredRecords.length}두</strong>
            </div>
            <div className={styles.filters}>
              <label><span>전입일</span><div className={styles.dateRange}><CalendarDays size={16} /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><i>~</i><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div></label>
              <label className={styles.searchFilter}><span>통합검색</span><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="웅돈번호, 이각번호, 구입처" /></div></label>
              <label className={styles.sortFilter}><span>정렬</span><div><select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)} aria-label="웅돈 전입 기록 정렬 기준"><option value="workDate">작업일</option><option value="animalNo">웅돈번호</option><option value="earTag">이각번호</option></select><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)} aria-label="웅돈 전입 기록 정렬 방향"><option value="desc">내림차순</option><option value="asc">오름차순</option></select></div></label>
              <button type="button" className={styles.filterButton} onClick={() => { setQuery(""); setFromDate("2026-06-26"); setToDate("2026-09-26"); setSortField("workDate"); setSortDirection("desc"); }}><SlidersHorizontal size={16} /> 초기화</button>
            </div>

            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th className={styles.checkColumn}><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} aria-label="조회된 웅돈 전입 기록 전체 선택" /></th><th>웅돈번호</th><th>이각번호</th><th>품종</th><th>출생일</th><th>전입일</th><th>웅돈구분</th><th>구입처</th><th>종모편입일</th><th>전입체중</th></tr></thead>
                <tbody>
                  {filteredRecords.length ? filteredRecords.map((record) => (
                    <tr key={record.id} className={selectedRecordIds.has(record.id) ? styles.selectedRow : ""}>
                      <td className={styles.checkColumn}><input type="checkbox" checked={selectedRecordIds.has(record.id)} onChange={() => toggleRecord(record.id)} aria-label={`${record.animalNo}번 웅돈 전입 기록 선택`} /></td>
                      <td><strong>{record.animalNo}</strong></td><td>{record.earTag || "-"}</td><td>{record.breed}</td><td>{record.birthDate}</td><td>{record.intakeDate}</td><td><span className={styles.statusBadge}>{record.boarType}</span></td><td>{record.source || "-"}</td><td>{record.serviceStartDate || "-"}</td><td>{record.weight ? `${record.weight} kg` : "-"}</td>
                    </tr>
                  )) : <tr><td className={styles.emptyTable} colSpan={10}>조건에 맞는 웅돈 전입 기록이 없습니다.</td></tr>}
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
