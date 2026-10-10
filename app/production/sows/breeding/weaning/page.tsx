"use client";

import { Activity, ArrowLeft, CalendarDays, ChevronDown, CircleHelp, Download, FileUp, Menu, PiggyBank, RotateCcw, Save, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { defaultFarrowingRecords, FarrowingRecord, readStoredFarrowingRecords } from "../../_data/farrowing-records";
import { defaultNursingPigletRecords, NursingPigletRecord, readStoredNursingPigletRecords } from "../../_data/nursing-piglet-records";
import { defaultWeaningRecords, readStoredWeaningRecords, ReNursingChoice, WEANING_RECORDS_STORAGE_KEY, WeaningRecord } from "../../_data/weaning-records";
import styles from "../../intake/page.module.css";

type SortField = "weaningDate" | "animalNo" | "earTag";
type SortDirection = "desc" | "asc";
type WeaningForm = Omit<WeaningRecord, "id" | "weaningAge" | "remainingFemale" | "remainingMale">;
type ImportError = { row: number; message: string };
type ImportResult = { successCount: number; skippedCount: number; errors: ImportError[] };

const emptyForm: WeaningForm = {
  animalNo: "", earTag: "", parity: "0", farrowingDate: "", weaningDate: "",
  femaleCount: "0", maleCount: "0", averageWeight: "", totalWeight: "",
  reNursing: "아니오", reNursingFemale: "0", reNursingMale: "0",
  fosterInFemale: "0", fosterInMale: "0", fosterInSow: "",
  fosterOutFemale: "0", fosterOutMale: "0", fosterOutSow: "",
  sowMoveLocation: "", pigletMoveDestination: "", note: "",
};

const count = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

function elapsedDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) return "";
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return String(Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000)));
}

type FieldProps = { label: string; required?: boolean; help?: string; children: React.ReactNode };
function Field({ label, required, help, children }: FieldProps) {
  return <label className={styles.field}><span className={styles.fieldLabel}>{label}{required ? <b>*</b> : null}{help ? <CircleHelp size={14} aria-label={help} /> : null}</span>{children}</label>;
}

export default function WeaningPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState<WeaningForm>(emptyForm);
  const [farrowingRecords, setFarrowingRecords] = useState<FarrowingRecord[]>(defaultFarrowingRecords);
  const [nursingRecords, setNursingRecords] = useState<NursingPigletRecord[]>(defaultNursingPigletRecords);
  const [records, setRecords] = useState<WeaningRecord[]>(defaultWeaningRecords);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [sowQuery, setSowQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("weaningDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [fromDate, setFromDate] = useState("2026-08-19");
  const [toDate, setToDate] = useState("2026-09-19");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFarrowingRecords(readStoredFarrowingRecords());
    setNursingRecords(readStoredNursingPigletRecords());
    setRecords(readStoredWeaningRecords());
    setRecordsLoaded(true);
  }, []);
  useEffect(() => {
    if (recordsLoaded) window.localStorage.setItem(WEANING_RECORDS_STORAGE_KEY, JSON.stringify(records));
  }, [records, recordsLoaded]);

  function nursingCounts(farrowing?: FarrowingRecord) {
    if (!farrowing) return { female: 0, male: 0 };
    const culls = count(farrowing.cullSmall) + count(farrowing.cullDeformity) + count(farrowing.cullOther);
    let female = Math.max(0, count(farrowing.liveFemale) - culls + count(farrowing.fosterInFemale) - count(farrowing.fosterOutFemale));
    let male = Math.max(0, count(farrowing.liveMale) + count(farrowing.fosterInMale) - count(farrowing.fosterOutMale));
    nursingRecords.filter((record) => record.animalNo === farrowing.animalNo && record.farrowingDate === farrowing.farrowingDate).forEach((record) => {
      const direction = record.category === "양자전입" ? 1 : -1;
      female = Math.max(0, female + direction * count(record.femaleCount));
      male = Math.max(0, male + direction * count(record.maleCount));
    });
    return { female, male };
  }

  const lactatingSows = useMemo(() => {
    const latest = new Map<string, FarrowingRecord>();
    [...farrowingRecords].sort((a, b) => b.farrowingDate.localeCompare(a.farrowingDate)).forEach((record) => {
      if (!latest.has(record.animalNo)) latest.set(record.animalNo, record);
    });
    const keyword = sowQuery.trim().toLowerCase();
    return [...latest.values()].filter((record) => {
      const alreadyWeaned = records.some((weaning) => weaning.animalNo === record.animalNo && weaning.farrowingDate === record.farrowingDate);
      const isSelected = form.animalNo === record.animalNo && form.farrowingDate === record.farrowingDate;
      const matches = !keyword || `${record.animalNo} ${record.earTag} ${record.breed}`.toLowerCase().includes(keyword);
      return (!alreadyWeaned || isSelected) && matches;
    });
  }, [farrowingRecords, form.animalNo, form.farrowingDate, records, sowQuery]);

  const latestFarrowingByAnimalNo = useMemo(() => {
    const latest = new Map<string, FarrowingRecord>();
    [...farrowingRecords].sort((a, b) => b.farrowingDate.localeCompare(a.farrowingDate)).forEach((record) => {
      if (!latest.has(record.animalNo)) latest.set(record.animalNo, record);
    });
    return latest;
  }, [farrowingRecords]);
  const fosterSowOptions = useMemo(() => [...latestFarrowingByAnimalNo.values()].filter((record) => record.animalNo !== form.animalNo), [form.animalNo, latestFarrowingByAnimalNo]);

  const selectedFarrowing = farrowingRecords.find((record) => record.animalNo === form.animalNo && record.farrowingDate === form.farrowingDate);
  const currentNursing = nursingCounts(selectedFarrowing);
  const availableFemale = Math.max(0, currentNursing.female + count(form.fosterInFemale) - count(form.fosterOutFemale));
  const availableMale = Math.max(0, currentNursing.male + count(form.fosterInMale) - count(form.fosterOutMale));
  const remainingFemale = Math.max(0, availableFemale - count(form.femaleCount));
  const remainingMale = Math.max(0, availableMale - count(form.maleCount));
  const weaningAge = elapsedDays(form.farrowingDate, form.weaningDate);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => record.weaningDate >= fromDate && record.weaningDate <= toDate && (!keyword || `${record.animalNo} ${record.earTag} ${record.sowMoveLocation} ${record.pigletMoveDestination}`.toLowerCase().includes(keyword))).sort((a, b) => {
      const left = a[sortField];
      const right = b[sortField];
      return left.localeCompare(right, "ko", { numeric: true }) * (sortDirection === "asc" ? 1 : -1);
    });
  }, [fromDate, query, records, sortDirection, sortField, toDate]);
  const allSelected = filteredRecords.length > 0 && filteredRecords.every((record) => selectedIds.has(record.id));

  function selectSow(record: FarrowingRecord) {
    setForm((current) => ({ ...current, animalNo: record.animalNo, earTag: record.earTag, parity: record.parity, farrowingDate: record.farrowingDate }));
    setSelectorOpen(false);
    setSowQuery("");
  }
  function handleSowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, record: FarrowingRecord) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectSow(record); }
  }
  function updateField(field: keyof WeaningForm, value: string) {
    setForm((current) => field === "reNursing" && value === "아니오"
      ? { ...current, reNursing: "아니오", reNursingFemale: "0", reNursingMale: "0" }
      : { ...current, [field]: value });
  }
  function resetForm() { setForm(emptyForm); setSelectorOpen(false); setSowQuery(""); }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFarrowing) { setNotice("이유 기록을 입력할 포유 모돈을 먼저 선택해 주세요."); return; }
    if (!form.weaningDate) { setNotice("이유일자를 입력해 주세요."); return; }
    if (form.weaningDate < form.farrowingDate) { setNotice("이유일자는 분만일보다 빠를 수 없습니다."); return; }
    if (count(form.fosterInFemale) + count(form.fosterInMale) > 0 && !form.fosterInSow.trim()) { setNotice("양자전입 모돈을 입력해 주세요."); return; }
    if (count(form.fosterOutFemale) + count(form.fosterOutMale) > 0 && !form.fosterOutSow.trim()) { setNotice("양자전출 모돈을 입력해 주세요."); return; }
    if (form.fosterInSow && !latestFarrowingByAnimalNo.has(form.fosterInSow)) { setNotice("전출 모돈은 분만 기록이 있는 모돈에서 선택해 주세요."); return; }
    if (form.fosterOutSow && !latestFarrowingByAnimalNo.has(form.fosterOutSow)) { setNotice("전입 모돈은 분만 기록이 있는 모돈에서 선택해 주세요."); return; }
    if ((form.fosterInSow && form.fosterInSow === form.animalNo) || (form.fosterOutSow && form.fosterOutSow === form.animalNo)) { setNotice("양자 이동 상대 모돈은 현재 모돈과 달라야 합니다."); return; }
    if (count(form.fosterOutFemale) > currentNursing.female + count(form.fosterInFemale) || count(form.fosterOutMale) > currentNursing.male + count(form.fosterInMale)) { setNotice("양자전출 두수가 현재 포유두수를 초과합니다."); return; }
    if (count(form.femaleCount) + count(form.maleCount) < 1) { setNotice("이유두수를 1두 이상 입력해 주세요."); return; }
    if (count(form.femaleCount) > availableFemale || count(form.maleCount) > availableMale) { setNotice(`이유두수는 조정 후 포유두수 암 ${availableFemale}두 / 수 ${availableMale}두 이내로 입력해 주세요.`); return; }
    if (form.reNursing === "예" && count(form.reNursingFemale) + count(form.reNursingMale) < 1) { setNotice("재포유 자돈의 암·수 두수를 입력해 주세요."); return; }
    if (count(form.reNursingFemale) > remainingFemale || count(form.reNursingMale) > remainingMale) { setNotice(`재포유 두수는 이유 후 잔여두수 암 ${remainingFemale}두 / 수 ${remainingMale}두 이내로 입력해 주세요.`); return; }
    const record: WeaningRecord = { id: Date.now(), ...form, weaningAge, remainingFemale: String(remainingFemale), remainingMale: String(remainingMale) };
    setRecords((current) => [record, ...current]);
    setNotice(`${form.animalNo}번 모돈의 이유 기록을 저장했습니다.`);
    resetForm();
  }

  async function uploadWorkbook(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setImportResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/weaning/import", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "엑셀 업로드에 실패했습니다.");

      const existingKeys = new Set(records.map((record) => `${record.animalNo}|${record.farrowingDate}`));
      const clientErrors: ImportError[] = [];
      const importedForms = (result.records as WeaningForm[]).flatMap((record, index) => {
        const row = index + 7;
        const farrowing = latestFarrowingByAnimalNo.get(record.animalNo);
        if (!farrowing) { clientErrors.push({ row, message: `분만 기록이 없는 모돈번호 ${record.animalNo}` }); return []; }
        const farrowingDate = record.farrowingDate || farrowing.farrowingDate;
        if (farrowingDate !== farrowing.farrowingDate) { clientErrors.push({ row, message: `${record.animalNo}번 모돈의 최근 분만일은 ${farrowing.farrowingDate}입니다.` }); return []; }
        if (existingKeys.has(`${record.animalNo}|${farrowingDate}`)) { clientErrors.push({ row, message: `이미 등록된 ${record.animalNo}번 모돈의 이유 기록` }); return []; }
        if (record.weaningDate < farrowingDate) { clientErrors.push({ row, message: "이유일은 분만일보다 빠를 수 없습니다." }); return []; }
        if (record.fosterInSow && !latestFarrowingByAnimalNo.has(record.fosterInSow)) { clientErrors.push({ row, message: `전출 모돈 ${record.fosterInSow}의 분만 기록이 없습니다.` }); return []; }
        if (record.fosterOutSow && !latestFarrowingByAnimalNo.has(record.fosterOutSow)) { clientErrors.push({ row, message: `전입 모돈 ${record.fosterOutSow}의 분만 기록이 없습니다.` }); return []; }
        if (record.fosterInSow === record.animalNo || record.fosterOutSow === record.animalNo) { clientErrors.push({ row, message: "양자 이동 상대 모돈은 현재 모돈과 달라야 합니다." }); return []; }
        const current = nursingCounts(farrowing);
        const availableF = current.female + count(record.fosterInFemale) - count(record.fosterOutFemale);
        const availableM = current.male + count(record.fosterInMale) - count(record.fosterOutMale);
        if (availableF < 0 || availableM < 0 || count(record.femaleCount) > availableF || count(record.maleCount) > availableM) { clientErrors.push({ row, message: `이유 또는 양자전출 두수가 현재 포유두수 암 ${current.female}두 / 수 ${current.male}두를 초과합니다.` }); return []; }
        const remainingF = availableF - count(record.femaleCount);
        const remainingM = availableM - count(record.maleCount);
        if (record.reNursing === "예" && count(record.reNursingFemale) + count(record.reNursingMale) < 1) { clientErrors.push({ row, message: "재포유여부가 예이면 재포유 두수를 입력해야 합니다." }); return []; }
        if (count(record.reNursingFemale) > remainingF || count(record.reNursingMale) > remainingM) { clientErrors.push({ row, message: "재포유 두수가 이유 후 잔여두수를 초과합니다." }); return []; }
        existingKeys.add(`${record.animalNo}|${farrowingDate}`);
        return [{ ...record, earTag: record.earTag || farrowing.earTag, parity: record.parity || farrowing.parity, farrowingDate }];
      });

      const imported = importedForms.map((record, index) => ({
        ...record,
        id: Date.now() + index,
        weaningAge: elapsedDays(record.farrowingDate, record.weaningDate),
        remainingFemale: String(Math.max(0, nursingCounts(latestFarrowingByAnimalNo.get(record.animalNo)).female + count(record.fosterInFemale) - count(record.fosterOutFemale) - count(record.femaleCount))),
        remainingMale: String(Math.max(0, nursingCounts(latestFarrowingByAnimalNo.get(record.animalNo)).male + count(record.fosterInMale) - count(record.fosterOutMale) - count(record.maleCount))),
      }));
      if (imported.length) setRecords((current) => [...imported, ...current]);
      const errors = [...(result.errors as ImportError[]), ...clientErrors];
      setImportResult({ successCount: imported.length, skippedCount: errors.length, errors });
      setNotice(`${imported.length}건의 이유 기록을 일괄 등록했습니다.${errors.length ? ` ${errors.length}행은 확인이 필요합니다.` : ""}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "엑셀 업로드에 실패했습니다.");
      setImportResult({ successCount: 0, skippedCount: 0, errors: [] });
    } finally { setUploading(false); }
  }
  function toggleRecord(id: number) { setSelectedIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function toggleAll() { setSelectedIds((current) => { const next = new Set(current); allSelected ? filteredRecords.forEach((record) => next.delete(record.id)) : filteredRecords.forEach((record) => next.add(record.id)); return next; }); }
  function deleteSelected() { const deleted = selectedIds.size; if (!deleted) return; setRecords((current) => current.filter((record) => !selectedIds.has(record.id))); setSelectedIds(new Set()); setNotice(`선택한 이유 기록 ${deleted}건을 삭제했습니다.`); }

  return <div className={styles.shell}>
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}><div className={styles.brand}><span><PiggyBank size={21} /></span><strong>피그매니저</strong><button onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기"><X size={19} /></button></div><Link className={styles.backLink} href="/"><ArrowLeft size={17} /> 대시보드</Link><div className={styles.navGroup}><div className={styles.navTitle}><span>생산관리</span><ChevronDown size={15} /></div><div className={styles.navSection}>모돈개체관리</div><Link className={styles.navItem} href="/production/sows/intake"><i />전입관리</Link><Link className={styles.navItem} href="/production/sows/first-estrus"><i />초발정관리</Link><span className={styles.activeNav}><i />번식관리</span><Link className={styles.navItem} href="/production/sows/backfat"><i />등지방관리</Link><Link className={styles.navItem} href="/production/sows/cull"><i />도폐사관리</Link></div></aside>
    {sidebarOpen ? <button className={styles.scrim} aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /> : null}
    <main className={styles.main}><header className={styles.topbar}><button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button><div><small>현재 농장</small><strong>해솔 번식농장</strong></div><span className={styles.topbarStatus}>예시 데이터</span></header><div className={styles.content}>
      <section className={styles.heading}><div><p>생산관리 / 모돈개체관리</p><h1>번식관리</h1><span>포유 중인 모돈의 이유 기록과 이동 내역을 관리합니다.</span></div><div className={styles.headingActions}><input ref={fileInputRef} className={styles.hiddenInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={uploadWorkbook} /><button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}><FileUp size={16} />{uploading ? "업로드 중..." : "데이터 업로드"}</button><a href="/templates/모돈이유등록양식.xlsx" download><Download size={16} />양식 다운로드</a></div></section>
      {importResult ? <section className={styles.importResult} aria-live="polite"><div><strong>업로드 결과</strong><span>등록 {importResult.successCount}건 · 확인 필요 {importResult.skippedCount}행</span></div>{importResult.errors.length ? <ul>{importResult.errors.slice(0, 8).map((error, index) => <li key={`${error.row}-${index}`}>{error.row}행: {error.message}</li>)}</ul> : <p>모든 행이 정상적으로 등록되었습니다.</p>}{importResult.errors.length > 8 ? <small>외 {importResult.errors.length - 8}건의 오류가 더 있습니다.</small> : null}</section> : null}
      <nav className={styles.breedingTabs} aria-label="번식관리 기록 구분"><Link href="/production/sows/breeding/mating">교배</Link><Link href="/production/sows/breeding/pregnancy-incident">임신사고</Link><Link href="/production/sows/breeding/farrowing">분만</Link><Link href="/production/sows/breeding/nursing-piglets">포유자돈</Link><Link className={styles.activeBreedingTab} href="/production/sows/breeding/weaning">이유</Link></nav>
      <section className={styles.infoStrip} aria-label="선택 모돈 정보"><div><span>모돈번호</span><strong>{form.animalNo || "선택 전"}</strong></div><div><span>이각번호</span><strong>{form.earTag || "-"}</strong></div><div><span>산차</span><strong>{form.parity}산</strong></div><div><span>분만일</span><strong>{form.farrowingDate || "-"}</strong></div><div><span>현재 포유두수</span><strong>{currentNursing.female} / {currentNursing.male}두</strong></div><div><span>합계</span><strong>{currentNursing.female + currentNursing.male}두</strong></div></section>
      <form className={styles.formCard} onSubmit={submitForm}><div className={styles.cardHead}><div><span className={styles.cardIcon}><Activity size={18} /></span><div><h2>이유 기록 입력</h2><p>포유 중인 모돈을 먼저 선택한 뒤 이유 정보를 입력하세요.</p></div></div><span className={styles.newBadge}>이유</span></div>
        <div className={styles.formSection}><h3>포유 모돈 선택</h3><div className={styles.formGrid}><label className={styles.field}><span className={styles.fieldLabel}>모돈번호<b>*</b><CircleHelp size={14} aria-label="분만 후 아직 이유되지 않은 모돈만 선택할 수 있습니다." /></span><div className={styles.selectorInput}><Search size={16} /><input value={selectorOpen ? sowQuery : form.animalNo} onFocus={() => { setSelectorOpen(true); setSowQuery(form.animalNo); }} onChange={(event) => setSowQuery(event.target.value)} placeholder="포유 모돈 검색·선택" autoComplete="off" /><ChevronDown size={16} /></div></label><Field label="이각번호"><span className={styles.calculatedField}>{form.earTag || "모돈 선택 필요"}</span></Field><Field label="분만일"><span className={styles.calculatedField}>{form.farrowingDate || "모돈 선택 필요"}</span></Field>
          {selectorOpen ? <div className={styles.sowSelector}><div className={styles.sowSelectorHead}><div><strong>이유 대상 모돈 목록</strong><span>분만 후 이유 기록이 없는 모돈만 표시됩니다.</span></div><button type="button" onClick={() => setSelectorOpen(false)} aria-label="선택 목록 닫기"><X size={16} /></button></div><div className={styles.sowSelectorTable}><table><thead><tr><th>모돈번호</th><th>이각번호</th><th>품종</th><th>산차</th><th>분만일</th><th>현재 포유두수(암/수)</th></tr></thead><tbody>{lactatingSows.length ? lactatingSows.map((record) => { const current = nursingCounts(record); return <tr key={record.id} tabIndex={0} onClick={() => selectSow(record)} onKeyDown={(event) => handleSowKeyDown(event, record)}><td><strong>{record.animalNo}</strong></td><td>{record.earTag || "-"}</td><td>{record.breed}</td><td>{record.parity}산</td><td>{record.farrowingDate}</td><td>{current.female} / {current.male}</td></tr>; }) : <tr><td colSpan={6} className={styles.emptySelector}>선택 가능한 포유 모돈이 없습니다.</td></tr>}</tbody></table></div><p>총 {lactatingSows.length}두 · 포유 중인 모돈을 먼저 선택해야 저장할 수 있습니다.</p></div> : null}
        </div></div>
        <div className={styles.formSection}><h3>이유 정보</h3><datalist id="weaning-farrowed-sows">{fosterSowOptions.map((record) => <option key={record.id} value={record.animalNo}>{record.earTag ? `${record.earTag} · ` : ""}{record.farrowingDate} 분만</option>)}</datalist><div className={styles.matingGrid}>
          <Field label="이유일자" required><input type="date" value={form.weaningDate} onChange={(event) => updateField("weaningDate", event.target.value)} /></Field>
          <Field label="이유일령"><span className={styles.calculatedField}>{weaningAge === "" ? "모돈과 이유일자 선택 필요" : `${weaningAge}일령`}</span></Field>
          <Field label="현재 포유두수(암/수)"><span className={styles.calculatedField}>{currentNursing.female} / {currentNursing.male}두</span></Field>
          <Field label="이유두수(암/수)" required><div className={styles.compoundInput}><input type="number" min="0" value={form.femaleCount} onChange={(event) => updateField("femaleCount", event.target.value)} aria-label="이유 암 두수" /><input type="number" min="0" value={form.maleCount} onChange={(event) => updateField("maleCount", event.target.value)} aria-label="이유 수 두수" /></div></Field>
          <Field label="자돈 평균체중(kg)"><input type="number" min="0" step="0.01" value={form.averageWeight} onChange={(event) => updateField("averageWeight", event.target.value)} /></Field>
          <Field label="자돈 총체중(kg)"><input type="number" min="0" step="0.01" value={form.totalWeight} onChange={(event) => updateField("totalWeight", event.target.value)} /></Field>
          <Field label="양자전입(암/수)"><div className={styles.compoundInput}><input type="number" min="0" value={form.fosterInFemale} onChange={(event) => updateField("fosterInFemale", event.target.value)} aria-label="양자전입 암 두수" /><input type="number" min="0" value={form.fosterInMale} onChange={(event) => updateField("fosterInMale", event.target.value)} aria-label="양자전입 수 두수" /></div></Field>
          <Field label="전출 모돈" help="분만 기록이 있는 모돈만 선택할 수 있습니다."><input list="weaning-farrowed-sows" value={form.fosterInSow} onChange={(event) => updateField("fosterInSow", event.target.value)} placeholder="분만 모돈 검색·선택" /></Field>
          <Field label="양자전출(암/수)"><div className={styles.compoundInput}><input type="number" min="0" value={form.fosterOutFemale} onChange={(event) => updateField("fosterOutFemale", event.target.value)} aria-label="양자전출 암 두수" /><input type="number" min="0" value={form.fosterOutMale} onChange={(event) => updateField("fosterOutMale", event.target.value)} aria-label="양자전출 수 두수" /></div></Field>
          <Field label="전입 모돈" help="분만 기록이 있는 모돈만 선택할 수 있습니다."><input list="weaning-farrowed-sows" value={form.fosterOutSow} onChange={(event) => updateField("fosterOutSow", event.target.value)} placeholder="분만 모돈 검색·선택" /></Field>
          <Field label="이유 후 잔여두수" help="잔여두수가 0이 아니어도 저장할 수 있습니다."><span className={styles.calculatedField}>{remainingFemale} / {remainingMale}두</span></Field>
          <Field label="재포유여부"><select value={form.reNursing} onChange={(event) => updateField("reNursing", event.target.value as ReNursingChoice)}><option value="아니오">아니오</option><option value="예">예</option></select></Field>
          <Field label="재포유 두수(암/수)"><div className={styles.compoundInput}><input type="number" min="0" disabled={form.reNursing === "아니오"} value={form.reNursingFemale} onChange={(event) => updateField("reNursingFemale", event.target.value)} aria-label="재포유 암 두수" /><input type="number" min="0" disabled={form.reNursing === "아니오"} value={form.reNursingMale} onChange={(event) => updateField("reNursingMale", event.target.value)} aria-label="재포유 수 두수" /></div></Field>
          <Field label="모돈이동 장소"><input value={form.sowMoveLocation} onChange={(event) => updateField("sowMoveLocation", event.target.value)} placeholder="예: 임신사 1동" /></Field>
          <Field label="자돈이동"><input value={form.pigletMoveDestination} onChange={(event) => updateField("pigletMoveDestination", event.target.value)} placeholder="예: 이유자돈사 A군" /></Field>
        </div><Field label="비고"><textarea rows={3} value={form.note} onChange={(event) => updateField("note", event.target.value)} /></Field></div>
        <div className={styles.formActions}><button type="button" className={styles.resetButton} onClick={resetForm}><RotateCcw size={16} />초기화</button><button type="submit" className={styles.saveButton}><Save size={17} />저장</button></div>
      </form>
      <section className={styles.listCard}><div className={styles.listHead}><div><h2>이유 기록 리스트</h2><p>모돈별 이유 내역을 조회하고 잘못된 기록을 선택 삭제할 수 있습니다.</p></div><strong>총 {filteredRecords.length}건</strong></div><div className={styles.filters}><label><span>이유일</span><div className={styles.dateRange}><CalendarDays size={16} /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><i>~</i><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div></label><label className={styles.searchFilter}><span>통합검색</span><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="모돈번호, 이각번호, 이동 장소" /></div></label><label className={styles.sortFilter}><span>정렬</span><div><select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}><option value="weaningDate">작업일</option><option value="animalNo">모돈번호</option><option value="earTag">이각번호</option></select><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)}><option value="desc">내림차순</option><option value="asc">오름차순</option></select></div></label><button type="button" className={styles.filterButton} onClick={() => { setQuery(""); setSortField("weaningDate"); setSortDirection("desc"); }}><SlidersHorizontal size={16} />초기화</button></div>
        <div className={styles.tableWrap}><table><thead><tr><th className={styles.checkColumn}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="조회된 이유 기록 전체 선택" /></th><th>모돈번호</th><th>이각번호</th><th>산차</th><th>이유일자</th><th>일령</th><th>이유두수(암/수)</th><th>잔여두수</th><th>평균체중</th><th>총체중</th><th>재포유</th><th>모돈이동</th><th>자돈이동</th><th>비고</th></tr></thead><tbody>{filteredRecords.length ? filteredRecords.map((record) => <tr key={record.id} className={selectedIds.has(record.id) ? styles.selectedRow : ""}><td className={styles.checkColumn}><input type="checkbox" checked={selectedIds.has(record.id)} onChange={() => toggleRecord(record.id)} aria-label={`${record.animalNo}번 이유 기록 선택`} /></td><td><strong>{record.animalNo}</strong></td><td>{record.earTag || "-"}</td><td>{record.parity}산</td><td>{record.weaningDate}</td><td>{record.weaningAge}일</td><td>{record.femaleCount} / {record.maleCount}</td><td>{record.remainingFemale} / {record.remainingMale}</td><td>{record.averageWeight ? `${record.averageWeight}kg` : "-"}</td><td>{record.totalWeight ? `${record.totalWeight}kg` : "-"}</td><td><span className={styles.statusBadge}>{record.reNursing}</span></td><td>{record.sowMoveLocation || "-"}</td><td>{record.pigletMoveDestination || "-"}</td><td>{record.note || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={14}>조건에 맞는 이유 기록이 없습니다.</td></tr>}</tbody></table></div><div className={styles.listFooter}><button type="button" className={styles.deleteButton} disabled={!selectedIds.size} onClick={deleteSelected}><Trash2 size={15} />선택 삭제{selectedIds.size ? ` (${selectedIds.size})` : ""}</button><div className={styles.pagination}><button disabled>이전</button><strong>1</strong><button disabled>다음</button></div></div>
      </section>
    </div></main>
    {notice ? <button className={styles.toast} onClick={() => setNotice("")}><span>{notice}</span><X size={15} /></button> : null}
  </div>;
}
