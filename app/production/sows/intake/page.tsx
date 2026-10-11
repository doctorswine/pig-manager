"use client";

import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Download,
  FileUp,
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
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { defaultIntakeRecords, INTAKE_RECORDS_STORAGE_KEY, readStoredIntakeRecords, SOW_BREED_OPTIONS, SowIntakeRecord } from "../_data/intake-records";
import styles from "./page.module.css";

type FormState = Omit<SowIntakeRecord, "id"> & {
  matingCount: string;
  lastWorkDate: string;
  note: string;
};

type ImportError = { row: number; message: string };
type ImportResult = { successCount: number; skippedCount: number; errors: ImportError[] };
type SortField = "workDate" | "animalNo" | "earTag";
type SortDirection = "desc" | "asc";

const emptyForm: FormState = {
  animalNo: "",
  earTag: "",
  breed: "F1",
  birthDate: "",
  intakeDate: "",
  status: "후보돈",
  source: "",
  weight: "",
  parity: "0",
  matingCount: "0",
  lastWorkDate: "",
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
      <span className={styles.fieldLabel}>{label}{required ? <b>*</b> : null}{help ? <CircleHelp size={14} aria-label={help} /> : null}</span>
      {children}
    </label>
  );
}

export default function IntakePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [records, setRecords] = useState(defaultIntakeRecords);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(() => new Set());
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("workDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [fromDate, setFromDate] = useState("2026-08-19");
  const [toDate, setToDate] = useState("2026-09-19");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecords(readStoredIntakeRecords());
    setRecordsLoaded(true);
  }, []);

  useEffect(() => {
    if (recordsLoaded) window.localStorage.setItem(INTAKE_RECORDS_STORAGE_KEY, JSON.stringify(records));
  }, [records, recordsLoaded]);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesKeyword = !keyword || `${record.animalNo} ${record.earTag} ${record.breed} ${record.source}`.toLowerCase().includes(keyword);
      return matchesKeyword && record.intakeDate >= fromDate && record.intakeDate <= toDate;
    }).sort((left, right) => {
      const leftValue = sortField === "workDate" ? left.intakeDate : left[sortField];
      const rightValue = sortField === "workDate" ? right.intakeDate : right[sortField];
      return leftValue.localeCompare(rightValue, "ko", { numeric: true }) * (sortDirection === "asc" ? 1 : -1);
    });
  }, [fromDate, query, records, sortDirection, sortField, toDate]);
  const allFilteredSelected = filteredRecords.length > 0 && filteredRecords.every((record) => selectedRecordIds.has(record.id));

  const registeredIdentifiers = useMemo(() => ({
    animalNos: new Set(records.map((record) => record.animalNo.trim().toLowerCase()).filter(Boolean)),
    earTags: new Set(records.map((record) => record.earTag.trim().toLowerCase()).filter(Boolean)),
  }), [records]);
  const animalNoDuplicate = Boolean(form.animalNo.trim()) && registeredIdentifiers.animalNos.has(form.animalNo.trim().toLowerCase());
  const earTagDuplicate = Boolean(form.earTag.trim()) && registeredIdentifiers.earTags.has(form.earTag.trim().toLowerCase());

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
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
    setNotice(`선택한 전입 기록 ${deletedCount}건을 삭제했습니다.`);
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.animalNo || !form.birthDate || !form.intakeDate) {
      setNotice("모돈번호, 출생일, 전입일을 입력해 주세요.");
      return;
    }
    if (animalNoDuplicate || earTagDuplicate) {
      const duplicateFields = [animalNoDuplicate ? "모돈번호" : "", earTagDuplicate ? "이각번호" : ""].filter(Boolean).join("와 ");
      setNotice(`${duplicateFields}가 기존 전입 기록과 중복됩니다. 번호를 확인해 주세요.`);
      return;
    }
    setRecords((current) => [{ id: Date.now(), ...form }, ...current]);
    setNotice(`${form.animalNo}번 모돈을 전입 목록에 추가했습니다.`);
    setForm(emptyForm);
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
      const response = await fetch("/api/intake/import", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "엑셀 업로드에 실패했습니다.");

      const existingAnimalNos = new Set(records.map((record) => record.animalNo));
      const duplicateErrors: ImportError[] = [];
      const uniqueRows = (result.records as FormState[]).filter((record, index) => {
        if (existingAnimalNos.has(record.animalNo)) {
          duplicateErrors.push({ row: index + 7, message: `이미 등록된 모돈번호 ${record.animalNo}` });
          return false;
        }
        existingAnimalNos.add(record.animalNo);
        return true;
      });
      const importedRecords: SowIntakeRecord[] = uniqueRows.map((record, index) => ({
        ...record,
        id: Date.now() + index,
      }));

      if (importedRecords.length) setRecords((current) => [...importedRecords, ...current]);
      const errors = [...(result.errors as ImportError[]), ...duplicateErrors];
      setImportResult({ successCount: importedRecords.length, skippedCount: errors.length, errors });
      setNotice(`${importedRecords.length}두를 일괄 등록했습니다.${errors.length ? ` ${errors.length}행은 확인이 필요합니다.` : ""}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "엑셀 업로드에 실패했습니다.";
      setNotice(message);
      setImportResult({ successCount: 0, skippedCount: 0, errors: [] });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}><span><PiggyBank size={21} /></span><strong>피그매니저</strong><button onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기"><X size={19} /></button></div>
        <Link className={styles.backLink} href="/"><ArrowLeft size={17} /> 대시보드</Link>
        <div className={styles.navGroup}>
          <div className={styles.navTitle}><span>생산관리</span><ChevronDown size={15} /></div>
          <div className={styles.navSection}>모돈개체관리</div>
          <span className={styles.activeNav}><i />전입관리</span>
          <Link className={styles.navItem} href="/production/sows/first-estrus"><i />초발정관리</Link>
          <Link className={styles.navItem} href="/production/sows/breeding/mating"><i />번식관리</Link>
          <Link className={styles.navItem} href="/production/sows/backfat"><i />등지방관리</Link>
          <Link className={styles.navItem} href="/production/sows/cull"><i />도폐사관리</Link>
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
            <div><p>생산관리 / 모돈개체관리</p><h1>전입관리</h1><span>새로 들어온 모돈을 등록하고 전입 이력을 조회합니다.</span></div>
            <div className={styles.headingActions}>
              <input ref={fileInputRef} className={styles.hiddenInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={uploadWorkbook} />
              <button disabled={uploading} onClick={() => fileInputRef.current?.click()}><FileUp size={16} /> {uploading ? "업로드 중..." : "데이터 업로드"}</button>
              <a href="/templates/모돈전입등록양식.xlsx" download><Download size={16} /> 양식 다운로드</a>
            </div>
          </section>

          {importResult ? (
            <section className={styles.importResult} aria-live="polite">
              <div><strong>업로드 결과</strong><span>등록 {importResult.successCount}두 · 확인 필요 {importResult.skippedCount}행</span></div>
              {importResult.errors.length ? (
                <ul>{importResult.errors.slice(0, 8).map((error, index) => <li key={`${error.row}-${index}`}>{error.row}행: {error.message}</li>)}</ul>
              ) : <p>모든 행이 정상적으로 등록되었습니다.</p>}
              {importResult.errors.length > 8 ? <small>외 {importResult.errors.length - 8}건의 오류가 더 있습니다.</small> : null}
            </section>
          ) : null}

          <form className={styles.formCard} onSubmit={submitForm}>
            <div className={styles.cardHead}>
              <div><span className={styles.cardIcon}><Plus size={18} /></span><div><h2>모돈 전입 등록</h2><p><b>*</b> 표시는 필수 입력 항목입니다.</p></div></div>
              <span className={styles.newBadge}>신규등록</span>
            </div>

            <div className={styles.formSection}>
              <h3>전입 정보</h3>
              <div className={styles.formGrid}>
                <label className={`${styles.field} ${animalNoDuplicate ? styles.duplicateField : ""}`}>
                  <span className={styles.fieldLabel}>모돈번호<b>*</b><CircleHelp size={14} aria-label="농장에서 사용하는 고유 모돈번호입니다." /></span>
                  <input value={form.animalNo} onChange={(event) => updateField("animalNo", event.target.value)} placeholder="예: 2961" aria-invalid={animalNoDuplicate} aria-describedby={animalNoDuplicate ? "animal-no-duplicate" : undefined} />
                  {animalNoDuplicate ? <small id="animal-no-duplicate" className={styles.duplicateMessage}>이미 등록된 모돈번호입니다.</small> : null}
                </label>
                <label className={`${styles.field} ${earTagDuplicate ? styles.duplicateField : ""}`}>
                  <span className={styles.fieldLabel}>이각번호</span>
                  <input value={form.earTag} onChange={(event) => updateField("earTag", event.target.value)} placeholder="이각번호 입력" aria-invalid={earTagDuplicate} aria-describedby={earTagDuplicate ? "ear-tag-duplicate" : undefined} />
                  {earTagDuplicate ? <small id="ear-tag-duplicate" className={styles.duplicateMessage}>이미 등록된 이각번호입니다.</small> : null}
                </label>
                <Field label="품종" required>
                  <select value={form.breed} onChange={(event) => updateField("breed", event.target.value)}>
                    {SOW_BREED_OPTIONS.map((breed, index) => <option key={breed} value={breed}>{index + 1}.{breed}</option>)}
                  </select>
                </Field>
                <Field label="출생일" required><input type="date" value={form.birthDate} onChange={(event) => updateField("birthDate", event.target.value)} /></Field>
                <Field label="전입일" required><input type="date" value={form.intakeDate} onChange={(event) => updateField("intakeDate", event.target.value)} /></Field>
                <Field label="최종 작업일"><input type="date" value={form.lastWorkDate} onChange={(event) => updateField("lastWorkDate", event.target.value)} /></Field>
                <Field label="구입처"><input value={form.source} onChange={(event) => updateField("source", event.target.value)} placeholder="구입처 입력" /></Field>
                <Field label="시작상태" required>
                  <select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
                    <option value="후보돈">1.후보돈</option>
                    <option value="임신돈">2.임신돈</option>
                    <option value="포유돈">3.포유돈</option>
                    <option value="이유모돈">4.이유모돈</option>
                    <option value="사고돈">5.사고돈</option>
                    <option value="대리모돈">6.대리모돈</option>
                    <option value="유산돈">7.유산돈</option>
                  </select>
                </Field>
                <Field label="전입체중(kg)"><input inputMode="decimal" value={form.weight} onChange={(event) => updateField("weight", event.target.value)} placeholder="0" /></Field>
                <Field label="시작산차" required><input inputMode="numeric" min="0" type="number" value={form.parity} onChange={(event) => updateField("parity", event.target.value)} /></Field>
                <Field label="교배차수"><input inputMode="numeric" min="0" type="number" value={form.matingCount} onChange={(event) => updateField("matingCount", event.target.value)} /></Field>
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
              <div><h2>모돈 전입 이력</h2><p>등록된 전입 내역을 날짜와 모돈번호로 조회합니다.</p></div>
              <strong>총 {filteredRecords.length}두</strong>
            </div>
            <div className={styles.filters}>
              <label><span>전입일</span><div className={styles.dateRange}><CalendarDays size={16} /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><i>~</i><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div></label>
              <label className={styles.searchFilter}><span>통합검색</span><div><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="모돈번호, 이각번호, 구입처" /></div></label>
              <label className={styles.sortFilter}><span>정렬</span><div><select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)} aria-label="전입 기록 정렬 기준"><option value="workDate">작업일</option><option value="animalNo">모돈번호</option><option value="earTag">이각번호</option></select><select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)} aria-label="전입 기록 정렬 방향"><option value="desc">내림차순</option><option value="asc">오름차순</option></select></div></label>
              <button className={styles.filterButton} onClick={() => { setQuery(""); setFromDate("2026-08-19"); setToDate("2026-09-19"); setSortField("workDate"); setSortDirection("desc"); }}><SlidersHorizontal size={16} /> 초기화</button>
            </div>

            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th className={styles.checkColumn}><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} aria-label="조회된 전입 기록 전체 선택" /></th><th>모돈번호</th><th>이각번호</th><th>품종</th><th>출생일</th><th>전입일</th><th>시작상태</th><th>구입처</th><th>전입체중</th></tr></thead>
                <tbody>
                  {filteredRecords.length ? filteredRecords.map((record) => (
                    <tr key={record.id} className={selectedRecordIds.has(record.id) ? styles.selectedRow : ""}><td className={styles.checkColumn}><input type="checkbox" checked={selectedRecordIds.has(record.id)} onChange={() => toggleRecord(record.id)} aria-label={`${record.animalNo}번 전입 기록 선택`} /></td><td><strong>{record.animalNo}</strong></td><td>{record.earTag || "-"}</td><td>{record.breed}</td><td>{record.birthDate}</td><td>{record.intakeDate}</td><td><span className={styles.statusBadge}>{record.status}</span></td><td>{record.source || "-"}</td><td>{record.weight ? `${record.weight} kg` : "-"}</td></tr>
                  )) : <tr><td className={styles.emptyTable} colSpan={9}>조건에 맞는 전입 기록이 없습니다.</td></tr>}
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
