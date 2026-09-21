"use client";

import { Activity, ArrowLeft, CalendarDays, ChevronDown, CircleHelp, Download, FileUp, Menu, PiggyBank, RotateCcw, Save, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { defaultFarrowingRecords, FARROWING_RECORDS_STORAGE_KEY, FarrowingRecord, readStoredFarrowingRecords } from "../../_data/farrowing-records";
import { defaultIntakeRecords, readStoredIntakeRecords, SowIntakeRecord } from "../../_data/intake-records";
import { defaultMatingRecords, MatingRecord, readStoredMatingRecords } from "../../_data/mating-records";
import styles from "../../intake/page.module.css";

type FarrowingForm = Omit<FarrowingRecord, "id">;
type SortField = "workDate" | "animalNo" | "earTag";
type SortDirection = "desc" | "asc";
type ImportError = { row: number; message: string };
type ImportResult = { successCount: number; skippedCount: number; errors: ImportError[] };

const emptyForm: FarrowingForm = {
  animalNo: "", earTag: "", breed: "F1", parity: "0", matingDate: "", farrowingDate: "", farrowingType: "정상", location: "",
  totalBorn: "", mummified: "0", stillborn: "0", liveFemale: "0", liveMale: "0", cullSmall: "0", cullDeformity: "0", cullOther: "0", nursingStart: "0",
  fosterInFemale: "0", fosterInMale: "0", fosterInSow: "", fosterOutFemale: "0", fosterOutMale: "0", fosterOutSow: "",
  averageBirthWeight: "", totalBirthWeight: "", note: "",
};

function count(value: string) { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0; }
function calculateCounts(form: FarrowingForm) {
  const expectedLiveBorn = Math.max(0, count(form.totalBorn) - count(form.mummified) - count(form.stillborn));
  const liveFemale = count(form.liveFemale);
  const liveMale = count(form.liveMale);
  const nursingStart = Math.max(0, liveFemale + liveMale - count(form.cullSmall) - count(form.cullDeformity) - count(form.cullOther));
  const fosterIn = count(form.fosterInFemale) + count(form.fosterInMale);
  const fosterOut = count(form.fosterOutFemale) + count(form.fosterOutMale);
  const finalNursing = Math.max(0, nursingStart + fosterIn - fosterOut);
  return { expectedLiveBorn, liveFemale, liveMale, nursingStart, fosterIn, fosterOut, finalNursing };
}

type FieldProps = { label: string; required?: boolean; help?: string; children: React.ReactNode };
function Field({ label, required, help, children }: FieldProps) {
  return <label className={styles.field}><span className={styles.fieldLabel}>{label}{required ? <b>*</b> : null}{help ? <CircleHelp size={14} aria-label={help} /> : null}</span>{children}</label>;
}

export default function FarrowingPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState<FarrowingForm>(emptyForm);
  const [records, setRecords] = useState(defaultFarrowingRecords);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [intakeRecords, setIntakeRecords] = useState<SowIntakeRecord[]>(defaultIntakeRecords);
  const [matingRecords, setMatingRecords] = useState<MatingRecord[]>(defaultMatingRecords);
  const [selectorField, setSelectorField] = useState<"animalNo" | "earTag" | null>(null);
  const [sowQuery, setSowQuery] = useState("");
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("workDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [fromDate, setFromDate] = useState("2026-08-19");
  const [toDate, setToDate] = useState("2026-09-19");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setIntakeRecords(readStoredIntakeRecords()); setMatingRecords(readStoredMatingRecords()); }, []);
  useEffect(() => { setRecords(readStoredFarrowingRecords()); setRecordsLoaded(true); }, []);
  useEffect(() => { if (recordsLoaded) window.localStorage.setItem(FARROWING_RECORDS_STORAGE_KEY, JSON.stringify(records)); }, [records, recordsLoaded]);

  const calculated = calculateCounts(form);
  const liveBornMismatch = form.totalBorn !== "" && calculated.liveFemale + calculated.liveMale !== calculated.expectedLiveBorn;
  const fosterSowOptions = useMemo(() => {
    const latest = new Map<string, FarrowingRecord>();
    [...records].sort((a, b) => b.farrowingDate.localeCompare(a.farrowingDate)).forEach((record) => { if (record.animalNo !== form.animalNo && !latest.has(record.animalNo)) latest.set(record.animalNo, record); });
    return [...latest.values()];
  }, [form.animalNo, records]);
  const selectableSows = useMemo(() => {
    const keyword = sowQuery.trim().toLowerCase();
    return intakeRecords.filter((sow) => !keyword || `${sow.animalNo} ${sow.earTag} ${sow.breed} ${sow.status}`.toLowerCase().includes(keyword));
  }, [intakeRecords, sowQuery]);
  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => (!keyword || `${record.animalNo} ${record.earTag} ${record.farrowingType} ${record.location}`.toLowerCase().includes(keyword)) && record.farrowingDate >= fromDate && record.farrowingDate <= toDate)
      .sort((left, right) => {
        const leftValue = sortField === "workDate" ? left.farrowingDate : left[sortField];
        const rightValue = sortField === "workDate" ? right.farrowingDate : right[sortField];
        return leftValue.localeCompare(rightValue, "ko", { numeric: true }) * (sortDirection === "asc" ? 1 : -1);
      });
  }, [fromDate, query, records, sortDirection, sortField, toDate]);
  const allFilteredSelected = filteredRecords.length > 0 && filteredRecords.every((record) => selectedRecordIds.has(record.id));

  function updateField(field: keyof FarrowingForm, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function updateBirthCount(field: "totalBorn" | "mummified" | "stillborn", value: string) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      const expectedLiveBorn = Math.max(0, count(next.totalBorn) - count(next.mummified) - count(next.stillborn));
      return { ...next, liveFemale: String(expectedLiveBorn), liveMale: "0" };
    });
  }
  function openSowSelector(field: "animalNo" | "earTag") { setSelectorField(field); setSowQuery(form[field]); }
  function latestMating(animalNo: string) { return matingRecords.filter((record) => record.animalNo === animalNo).sort((a, b) => b.matingDate.localeCompare(a.matingDate))[0]; }
  function selectSow(sow: SowIntakeRecord) {
    const mating = latestMating(sow.animalNo);
    setForm((current) => ({ ...current, animalNo: sow.animalNo, earTag: sow.earTag, breed: sow.breed, parity: sow.parity || "0", matingDate: mating?.matingDate || "" }));
    setSelectorField(null); setSowQuery("");
  }
  function handleSowRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, sow: SowIntakeRecord) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectSow(sow); } }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.animalNo || !form.farrowingDate || form.totalBorn === "") { setNotice("모돈번호, 분만일, 총산을 입력해 주세요."); return; }
    if (count(form.mummified) + count(form.stillborn) > count(form.totalBorn)) { setNotice("미라와 사산 합계는 총산보다 클 수 없습니다."); return; }
    if (calculated.liveFemale + calculated.liveMale !== calculated.expectedLiveBorn) { setNotice(`실산 암·수 합계는 ${calculated.expectedLiveBorn}두여야 합니다.`); return; }
    if (count(form.cullSmall) + count(form.cullDeformity) + count(form.cullOther) > calculated.liveFemale + calculated.liveMale) { setNotice("생시도태 합계는 실산보다 클 수 없습니다."); return; }
    if (calculated.fosterIn > 0 && !form.fosterInSow.trim()) { setNotice("양자전입 두수가 있으면 전입 모돈을 선택해 주세요."); return; }
    if (calculated.fosterOut > 0 && !form.fosterOutSow.trim()) { setNotice("양자전출 두수가 있으면 전출 모돈을 선택해 주세요."); return; }
    if (form.fosterInSow === form.animalNo || form.fosterOutSow === form.animalNo) { setNotice("양자 이동 상대 모돈은 현재 모돈과 달라야 합니다."); return; }
    if (calculated.fosterOut > calculated.nursingStart + calculated.fosterIn) { setNotice("양자전출 두수는 전입 후 포유두수를 넘을 수 없습니다."); return; }
    const record: FarrowingRecord = { id: Date.now(), ...form, liveFemale: String(calculated.liveFemale), liveMale: String(calculated.liveMale), nursingStart: String(calculated.nursingStart) };
    setRecords((current) => [record, ...current]);
    setNotice(`${form.animalNo}번 모돈의 분만 기록을 저장했습니다.`); setForm(emptyForm);
  }

  function toggleRecord(id: number) { setSelectedRecordIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function toggleAllFiltered() { setSelectedRecordIds((current) => { const next = new Set(current); allFilteredSelected ? filteredRecords.forEach((r) => next.delete(r.id)) : filteredRecords.forEach((r) => next.add(r.id)); return next; }); }
  function deleteSelectedRecords() { if (!selectedRecordIds.size) return; const countDeleted = selectedRecordIds.size; setRecords((current) => current.filter((record) => !selectedRecordIds.has(record.id))); setSelectedRecordIds(new Set()); setNotice(`선택한 분만 기록 ${countDeleted}건을 삭제했습니다.`); }

  async function uploadWorkbook(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setUploading(true); setImportResult(null);
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/farrowing/import", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "엑셀 업로드에 실패했습니다.");
      const intakeByAnimalNo = new Map(intakeRecords.map((record) => [record.animalNo.trim().toLowerCase(), record]));
      const existingKeys = new Set(records.map((record) => `${record.animalNo}|${record.farrowingDate}`));
      const clientErrors: ImportError[] = [];
      const uniqueRows = (result.records as FarrowingForm[]).flatMap((record, index) => {
        const sow = intakeByAnimalNo.get(record.animalNo.trim().toLowerCase());
        if (!sow) { clientErrors.push({ row: index + 7, message: `전입관리에 등록되지 않은 모돈번호 ${record.animalNo}` }); return []; }
        const key = `${record.animalNo}|${record.farrowingDate}`;
        if (existingKeys.has(key)) { clientErrors.push({ row: index + 7, message: `이미 등록된 ${record.animalNo}번 모돈의 ${record.farrowingDate} 분만 기록` }); return []; }
        existingKeys.add(key);
        const mating = latestMating(record.animalNo);
        return [{ ...record, earTag: record.earTag || sow.earTag, breed: record.breed || sow.breed, parity: record.parity || sow.parity || "0", matingDate: record.matingDate || mating?.matingDate || "" }];
      });
      const imported = uniqueRows.map((record, index) => ({ ...record, id: Date.now() + index }));
      if (imported.length) setRecords((current) => [...imported, ...current]);
      const errors = [...(result.errors as ImportError[]), ...clientErrors];
      setImportResult({ successCount: imported.length, skippedCount: errors.length, errors });
      setNotice(`${imported.length}건의 분만 기록을 일괄 등록했습니다.${errors.length ? ` ${errors.length}행은 확인이 필요합니다.` : ""}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "엑셀 업로드에 실패했습니다.");
      setImportResult({ successCount: 0, skippedCount: 0, errors: [] });
    } finally { setUploading(false); }
  }

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}><span><PiggyBank size={21} /></span><strong>피그매니저</strong><button onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기"><X size={19} /></button></div>
        <Link className={styles.backLink} href="/"><ArrowLeft size={17} /> 대시보드</Link>
        <div className={styles.navGroup}><div className={styles.navTitle}><span>생산관리</span><ChevronDown size={15} /></div><div className={styles.navSection}>모돈개체관리</div><Link className={styles.navItem} href="/production/sows/intake"><i />전입관리</Link><Link className={styles.navItem} href="/production/sows/first-estrus"><i />초발정관리</Link><span className={styles.activeNav}><i />번식관리</span>{["등지방관리", "도폐사관리"].map((item) => <button key={item} onClick={() => setNotice(`${item}는 다음 단계에서 구성합니다.`)}><i />{item}</button>)}</div>
      </aside>
      {sidebarOpen ? <button className={styles.scrim} aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /> : null}
      <main className={styles.main}>
        <header className={styles.topbar}><button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button><div><small>현재 농장</small><strong>해솔 번식농장</strong></div><span className={styles.topbarStatus}>예시 데이터</span></header>
        <div className={styles.content}>
          <section className={styles.heading}>
            <div><p>생산관리 / 모돈개체관리</p><h1>번식관리</h1><span>교배부터 이유까지 모돈의 번식 기록을 단계별로 관리합니다.</span></div>
            <div className={styles.headingActions}><input ref={fileInputRef} className={styles.hiddenInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={uploadWorkbook} /><button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}><FileUp size={16} />{uploading ? "업로드 중..." : "데이터 업로드"}</button><a href="/templates/모돈분만등록양식.xlsx" download><Download size={16} />양식 다운로드</a></div>
          </section>
          {importResult ? <section className={styles.importResult} aria-live="polite"><div><strong>업로드 결과</strong><span>등록 {importResult.successCount}건 · 확인 필요 {importResult.skippedCount}행</span></div>{importResult.errors.length ? <ul>{importResult.errors.slice(0, 8).map((error, index) => <li key={`${error.row}-${index}`}>{error.row}행: {error.message}</li>)}</ul> : <p>모든 행이 정상적으로 등록되었습니다.</p>}{importResult.errors.length > 8 ? <small>외 {importResult.errors.length - 8}건의 오류가 더 있습니다.</small> : null}</section> : null}
          <nav className={styles.breedingTabs} aria-label="번식관리 기록 구분"><Link href="/production/sows/breeding/mating">교배</Link><Link href="/production/sows/breeding/pregnancy-incident">임신사고</Link><Link className={styles.activeBreedingTab} href="/production/sows/breeding/farrowing">분만</Link><Link href="/production/sows/breeding/nursing-piglets">포유자돈</Link><Link href="/production/sows/breeding/weaning">이유</Link></nav>

          <section className={styles.infoStrip} aria-label="선택 모돈 정보"><div><span>모돈번호</span><strong>{form.animalNo || "선택 전"}</strong></div><div><span>이각번호</span><strong>{form.earTag || "-"}</strong></div><div><span>품종</span><strong>{form.breed}</strong></div><div><span>산차</span><strong>{form.parity}산</strong></div><div><span>교배일</span><strong>{form.matingDate || "-"}</strong></div><div><span>실산 합계</span><strong>{calculated.liveFemale + calculated.liveMale}두</strong></div></section>

          <form className={styles.formCard} onSubmit={submitForm}>
            <div className={styles.cardHead}><div><span className={styles.cardIcon}><Activity size={18} /></span><div><h2>모돈 분만 기록 입력</h2><p><b>*</b> 표시는 필수 입력 항목입니다.</p></div></div><span className={styles.newBadge}>분만</span></div>
            <div className={styles.formSection}><h3>모돈 정보</h3><div className={styles.formGrid}>
              <label className={styles.field}><span className={styles.fieldLabel}>모돈번호<b>*</b><CircleHelp size={14} aria-label="전입 기록에서 분만 모돈을 선택합니다." /></span><div className={styles.selectorInput}><Search size={16} /><input value={selectorField === "animalNo" ? sowQuery : form.animalNo} onFocus={() => openSowSelector("animalNo")} onChange={(event) => setSowQuery(event.target.value)} placeholder="모돈번호 검색·선택" autoComplete="off" /><ChevronDown size={16} /></div></label>
              <label className={styles.field}><span className={styles.fieldLabel}>이각번호</span><div className={styles.selectorInput}><Search size={16} /><input value={selectorField === "earTag" ? sowQuery : form.earTag} onFocus={() => openSowSelector("earTag")} onChange={(event) => setSowQuery(event.target.value)} placeholder="이각번호 검색·선택" autoComplete="off" /><ChevronDown size={16} /></div></label>
              <Field label="최근 교배일"><span className={styles.calculatedField}>{form.matingDate || "교배 기록 없음"}</span></Field>
              {selectorField ? <div className={styles.sowSelector}><div className={styles.sowSelectorHead}><div><strong>전입 개체 목록</strong><span>모돈번호 또는 이각번호로 검색해 선택하세요.</span></div><button type="button" onClick={() => setSelectorField(null)} aria-label="선택 목록 닫기"><X size={16} /></button></div><div className={styles.sowSelectorTable}><table><thead><tr><th>모돈번호</th><th>이각번호</th><th>품종</th><th>전입일</th><th>시작상태</th><th>산차</th><th>최근 교배일</th></tr></thead><tbody>{selectableSows.length ? selectableSows.map((sow) => <tr key={sow.id} tabIndex={0} onClick={() => selectSow(sow)} onKeyDown={(event) => handleSowRowKeyDown(event, sow)}><td><strong>{sow.animalNo}</strong></td><td>{sow.earTag || "-"}</td><td>{sow.breed}</td><td>{sow.intakeDate}</td><td><span className={styles.statusBadge}>{sow.status}</span></td><td>{sow.parity || "0"}산</td><td>{latestMating(sow.animalNo)?.matingDate || "-"}</td></tr>) : <tr><td colSpan={7} className={styles.emptySelector}>검색 결과가 없습니다.</td></tr>}</tbody></table></div><p>총 {selectableSows.length}두 · 전입관리에서 등록한 개체만 표시됩니다.</p></div> : null}
            </div></div>
            <div className={styles.formSection}><h3>분만 정보</h3><div className={styles.matingGrid}>
              <Field label="분만일" required><input type="date" value={form.farrowingDate} onChange={(event) => updateField("farrowingDate", event.target.value)} /></Field>
              <Field label="분만구분" required><select value={form.farrowingType} onChange={(event) => updateField("farrowingType", event.target.value)}><option value="정상">1.정상</option><option value="조산">2.조산</option><option value="유도분만">3.유도분만</option><option value="난산">4.난산</option></select></Field>
              <Field label="분만장소"><input value={form.location} onChange={(event) => updateField("location", event.target.value)} placeholder="분만사·돈방 입력" /></Field>
              <Field label="총산" required><input type="number" min="0" value={form.totalBorn} onChange={(event) => updateBirthCount("totalBorn", event.target.value)} placeholder="0" /></Field>
              <Field label="미라"><input type="number" min="0" value={form.mummified} onChange={(event) => updateBirthCount("mummified", event.target.value)} /></Field>
              <Field label="사산"><input type="number" min="0" value={form.stillborn} onChange={(event) => updateBirthCount("stillborn", event.target.value)} /></Field>
            </div></div>
            <div className={styles.formSection}><h3>생시도태 및 포유개시</h3><div className={styles.matingGrid}>
              <Field label="생시도태 · 체미"><input type="number" min="0" value={form.cullSmall} onChange={(event) => updateField("cullSmall", event.target.value)} /></Field>
              <Field label="생시도태 · 기형"><input type="number" min="0" value={form.cullDeformity} onChange={(event) => updateField("cullDeformity", event.target.value)} /></Field>
              <Field label="생시도태 · 기타"><input type="number" min="0" value={form.cullOther} onChange={(event) => updateField("cullOther", event.target.value)} /></Field>
              <Field label="실산 · 암" help="총산에서 미라와 사산을 뺀 값이 먼저 자동 입력되며 직접 수정할 수 있습니다."><input className={liveBornMismatch ? styles.invalidCount : ""} type="number" min="0" value={form.liveFemale} onChange={(event) => updateField("liveFemale", event.target.value)} aria-invalid={liveBornMismatch} /></Field>
              <Field label="실산 · 수" help="필요한 경우 암 두수를 줄이고 수 두수를 직접 입력하세요."><input className={liveBornMismatch ? styles.invalidCount : ""} type="number" min="0" value={form.liveMale} onChange={(event) => updateField("liveMale", event.target.value)} aria-invalid={liveBornMismatch} /></Field>
              <Field label="포유개시" help="실산에서 체미·기형·기타 생시도태를 뺀 값입니다."><span className={styles.calculatedField}>{calculated.nursingStart}두</span></Field>
              {liveBornMismatch ? <p className={styles.countValidation} role="alert">자동 실산은 {calculated.expectedLiveBorn}두입니다. 암·수 합계를 {calculated.expectedLiveBorn}두로 맞춰 주세요. 현재 합계: {calculated.liveFemale + calculated.liveMale}두</p> : null}
              <Field label="자돈 평균체중(kg)"><input type="number" min="0" step="0.01" value={form.averageBirthWeight} onChange={(event) => updateField("averageBirthWeight", event.target.value)} /></Field>
              <Field label="자돈 총체중(kg)"><input type="number" min="0" step="0.01" value={form.totalBirthWeight} onChange={(event) => updateField("totalBirthWeight", event.target.value)} /></Field>
            </div><Field label="비고"><textarea rows={3} value={form.note} onChange={(event) => updateField("note", event.target.value)} placeholder="분만 관련 참고사항을 입력하세요." /></Field></div>
            <div className={styles.formSection}><h3>양자 이동</h3><datalist id="farrowing-foster-sows">{fosterSowOptions.map((sow) => <option key={sow.id} value={sow.animalNo}>{sow.earTag ? `${sow.earTag} · ` : ""}{sow.farrowingDate} 분만</option>)}</datalist><div className={styles.matingGrid}>
              <Field label="양자전입 · 암/수"><div className={styles.compoundInput}><input type="number" min="0" value={form.fosterInFemale} onChange={(event) => updateField("fosterInFemale", event.target.value)} aria-label="양자전입 암 두수" /><input type="number" min="0" value={form.fosterInMale} onChange={(event) => updateField("fosterInMale", event.target.value)} aria-label="양자전입 수 두수" /></div></Field>
              <Field label="전입 모돈" required={calculated.fosterIn > 0}><input list="farrowing-foster-sows" value={form.fosterInSow} onChange={(event) => updateField("fosterInSow", event.target.value)} placeholder="보낸 모돈번호 입력·선택" /></Field>
              <Field label="전입 후 포유두수"><span className={styles.calculatedField}>{calculated.nursingStart + calculated.fosterIn}두</span></Field>
              <Field label="양자전출 · 암/수"><div className={styles.compoundInput}><input type="number" min="0" value={form.fosterOutFemale} onChange={(event) => updateField("fosterOutFemale", event.target.value)} aria-label="양자전출 암 두수" /><input type="number" min="0" value={form.fosterOutMale} onChange={(event) => updateField("fosterOutMale", event.target.value)} aria-label="양자전출 수 두수" /></div></Field>
              <Field label="전출 모돈" required={calculated.fosterOut > 0}><input list="farrowing-foster-sows" value={form.fosterOutSow} onChange={(event) => updateField("fosterOutSow", event.target.value)} placeholder="받는 모돈번호 입력·선택" /></Field>
              <Field label="최종 포유두수" help="포유개시 + 양자전입 - 양자전출"><span className={styles.calculatedField}>{calculated.finalNursing}두</span></Field>
            </div></div>
            <div className={styles.formActions}><button type="button" className={styles.resetButton} onClick={() => setForm(emptyForm)}><RotateCcw size={16} />초기화</button><button type="submit" className={styles.saveButton}><Save size={17} />저장</button></div>
          </form>

          <section className={styles.listCard}><div className={styles.listHead}><div><h2>모돈 분만 기록 리스트</h2><p>등록된 분만 기록을 날짜와 모돈번호로 조회합니다.</p></div><strong>총 {filteredRecords.length}두</strong></div>
            <div className={styles.filters}><label><span>분만일</span><div className={styles.dateRange}><CalendarDays size={16} /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><i>~</i><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div></label><label className={styles.searchFilter}><span>통합검색</span><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="모돈번호, 이각번호, 분만구분" /></div></label><label className={styles.sortFilter}><span>정렬</span><div><select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}><option value="workDate">작업일</option><option value="animalNo">모돈번호</option><option value="earTag">이각번호</option></select><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)}><option value="desc">내림차순</option><option value="asc">오름차순</option></select></div></label><button type="button" className={styles.filterButton} onClick={() => { setQuery(""); setFromDate("2026-08-19"); setToDate("2026-09-19"); setSortField("workDate"); setSortDirection("desc"); }}><SlidersHorizontal size={16} />초기화</button></div>
            <div className={styles.tableWrap}><table><thead><tr><th className={styles.checkColumn}><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} aria-label="조회된 분만 기록 전체 선택" /></th><th>모돈번호</th><th>이각번호</th><th>산차</th><th>교배일</th><th>분만일</th><th>총산</th><th>미라</th><th>사산</th><th>실산(암/수)</th><th>포유개시</th><th>양자전입(암/수)</th><th>양자전출(암/수)</th><th>최종 포유</th><th>분만구분</th><th>분만장소</th><th>비고</th></tr></thead><tbody>{filteredRecords.length ? filteredRecords.map((record) => { const fosterIn = count(record.fosterInFemale || "0") + count(record.fosterInMale || "0"); const fosterOut = count(record.fosterOutFemale || "0") + count(record.fosterOutMale || "0"); return <tr key={record.id} className={selectedRecordIds.has(record.id) ? styles.selectedRow : ""}><td className={styles.checkColumn}><input type="checkbox" checked={selectedRecordIds.has(record.id)} onChange={() => toggleRecord(record.id)} aria-label={`${record.animalNo}번 분만 기록 선택`} /></td><td><strong>{record.animalNo}</strong></td><td>{record.earTag || "-"}</td><td>{record.parity}산</td><td>{record.matingDate || "-"}</td><td>{record.farrowingDate}</td><td>{record.totalBorn}</td><td>{record.mummified}</td><td>{record.stillborn}</td><td>{record.liveFemale}/{record.liveMale}</td><td>{record.nursingStart}</td><td>{record.fosterInFemale || "0"}/{record.fosterInMale || "0"}{record.fosterInSow ? ` · ${record.fosterInSow}` : ""}</td><td>{record.fosterOutFemale || "0"}/{record.fosterOutMale || "0"}{record.fosterOutSow ? ` · ${record.fosterOutSow}` : ""}</td><td>{Math.max(0, count(record.nursingStart) + fosterIn - fosterOut)}</td><td><span className={styles.statusBadge}>{record.farrowingType}</span></td><td>{record.location || "-"}</td><td>{record.note || "-"}</td></tr>; }) : <tr><td className={styles.emptyTable} colSpan={17}>조건에 맞는 분만 기록이 없습니다.</td></tr>}</tbody></table></div>
            <div className={styles.listFooter}><button type="button" className={styles.deleteButton} disabled={!selectedRecordIds.size} onClick={deleteSelectedRecords}><Trash2 size={15} />선택 삭제{selectedRecordIds.size ? ` (${selectedRecordIds.size})` : ""}</button><div className={styles.pagination}><button disabled>이전</button><strong>1</strong><button disabled>다음</button></div></div>
          </section>
        </div>
      </main>
      {notice ? <button className={styles.toast} onClick={() => setNotice("")}><span>{notice}</span><X size={15} /></button> : null}
    </div>
  );
}
