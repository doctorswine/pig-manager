"use client";

import { ArrowLeft, CalendarDays, ChevronDown, CloudDownload, Link2, Menu, PiggyBank, Search, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "../../sows/intake/page.module.css";

type GradeResult = {
  id: string; gradeDate: string; issueDate: string; sex: string; slaughterhouseCode: string; slaughterhouseName: string;
  slaughterhouseAddress: string; slaughterNo: string; backfat: string; finalGrade: string; carcassWeight: string;
  auctionPrice: string; pigTraceNo: string; confirmationNo: string; skinType: string;
};

type LookupMode = "farm" | "certificate";
type SavedSettings = {
  lookupMode: LookupMode; farmId: string; sequenceHint: number; fromDate: string; toDate: string;
  issueNo: string; issueDate: string; lastSyncedAt: string;
};

const RECORDS_KEY = "pig-manager:ekape-grade-results";
const SETTINGS_KEY = "pig-manager:ekape-grade-settings";
const PAGE_SIZE = 10;

export default function GradeResultsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lookupMode, setLookupMode] = useState<LookupMode>("farm");
  const [farmId, setFarmId] = useState("500992");
  const [sequenceHint, setSequenceHint] = useState(1708);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [issueNo, setIssueNo] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [records, setRecords] = useState<GradeResult[]>([]);
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    try {
      const storedRecords = window.localStorage.getItem(RECORDS_KEY);
      const storedSettings = window.localStorage.getItem(SETTINGS_KEY);
      if (storedRecords) setRecords(JSON.parse(storedRecords) as GradeResult[]);
      if (storedSettings) {
        const settings = JSON.parse(storedSettings) as Partial<SavedSettings>;
        setLookupMode(settings.lookupMode ?? "farm");
        setFarmId(settings.farmId ?? "500992");
        setSequenceHint(settings.sequenceHint ?? 1708);
        setFromDate(settings.fromDate ?? "");
        setToDate(settings.toDate ?? "");
        setIssueNo(settings.issueNo ?? "");
        setIssueDate(settings.issueDate ?? "");
        setLastSyncedAt(settings.lastSyncedAt ?? "");
      }
    } catch { /* 손상된 브라우저 저장값은 빈 상태로 시작한다. */ }
  }, []);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => {
      const dateMatches = lookupMode !== "farm" || !fromDate || !toDate || (record.gradeDate >= fromDate && record.gradeDate <= toDate);
      const keywordMatches = !keyword || `${record.gradeDate} ${record.issueDate} ${record.slaughterhouseName} ${record.slaughterhouseAddress} ${record.slaughterNo} ${record.finalGrade} ${record.pigTraceNo} ${record.confirmationNo}`.toLowerCase().includes(keyword);
      return dateMatches && keywordMatches;
    });
  }, [fromDate, lookupMode, query, records, toDate]);

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageWindowStart = Math.min(Math.max(1, currentPage - 2), Math.max(1, pageCount - 4));
  const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, index) => pageWindowStart + index);

  function settings(nextSyncedAt = lastSyncedAt): SavedSettings {
    return { lookupMode, farmId, sequenceHint, fromDate, toDate, issueNo, issueDate, lastSyncedAt: nextSyncedAt };
  }

  function saveSettings(nextSyncedAt = lastSyncedAt) {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings(nextSyncedAt)));
  }

  async function syncResults() {
    const params = new URLSearchParams();
    if (lookupMode === "farm") {
      if (!/^\d{6}$/.test(farmId)) { setNotice("농장식별번호는 숫자 6자리로 입력해 주세요."); return; }
      if (!fromDate || !toDate || fromDate > toDate) { setNotice("올바른 판정일 시작일과 종료일을 선택해 주세요."); return; }
      params.set("farmId", farmId);
      params.set("fromDate", fromDate);
      params.set("toDate", toDate);
      params.set("sequenceHint", String(sequenceHint));
    } else {
      if (!/^[0-9A-Za-z-]{1,20}$/.test(issueNo.trim())) { setNotice("확인서 발급번호를 영문, 숫자, 하이픈 20자 이내로 입력해 주세요."); return; }
      params.set("issueNo", issueNo.trim());
      if (issueDate) params.set("issueDate", issueDate);
    }

    setSyncing(true);
    setNotice("");
    saveSettings();
    try {
      const response = await fetch(`/api/ekape/grade-results?${params.toString()}`, { cache: "no-store" });
      const result = await response.json() as {
        records?: GradeResult[]; syncedAt?: string; scannedCount?: number; certificateCount?: number;
        latestKnownSequence?: number; message?: string;
      };
      if (!response.ok) throw new Error(result.message || "등급판정정보를 불러오지 못했습니다.");
      const nextRecords = result.records ?? [];
      const incomingIds = new Set(nextRecords.map((record) => record.id));
      const merged = [...nextRecords, ...records.filter((record) => !incomingIds.has(record.id))];
      const syncedAt = result.syncedAt ?? new Date().toISOString();
      const nextSequenceHint = result.latestKnownSequence ?? sequenceHint;
      setRecords(merged);
      setLastSyncedAt(syncedAt);
      setSequenceHint(nextSequenceHint);
      setPage(1);
      window.localStorage.setItem(RECORDS_KEY, JSON.stringify(merged));
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings(syncedAt), sequenceHint: nextSequenceHint }));
      if (lookupMode === "farm") setNotice(`이력번호 ${result.scannedCount ?? 0}개를 자동 확인해 확인서 ${result.certificateCount ?? 0}건, 등급판정 ${nextRecords.length}건을 불러왔습니다.`);
      else setNotice(nextRecords.length ? `실제 등급판정정보 ${nextRecords.length}건을 불러왔습니다.` : "해당 발급번호의 등급판정정보가 없습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "등급판정정보를 불러오지 못했습니다.");
    } finally { setSyncing(false); }
  }

  const lookupSummary = lookupMode === "farm"
    ? `${farmId || "농장번호 미입력"} / ${fromDate || "시작일 미선택"}~${toDate || "종료일 미선택"}`
    : `${issueNo || "발급번호 미입력"}${issueDate ? ` / ${issueDate}` : ""}`;

  return <div className={styles.shell}>
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
      <div className={styles.brand}><span><PiggyBank size={21} /></span><strong>피그매니저</strong><button onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기"><X size={19} /></button></div>
      <Link className={styles.backLink} href="/"><ArrowLeft size={17} /> 대시보드</Link>
      <div className={styles.navGroup}><div className={styles.navTitle}><span>생산관리</span><ChevronDown size={15} /></div><div className={styles.navSection}>모돈개체관리</div><Link className={styles.navItem} href="/production/sows/intake"><i />전입관리</Link><Link className={styles.navItem} href="/production/sows/breeding/mating"><i />번식관리</Link><div className={styles.navSection}>비육돈그룹관리</div><Link className={styles.navItem} href="/production/fattening-groups/registration"><i />그룹등록</Link><Link className={styles.navItem} href="/production/fattening-groups/movement-intake"><i />두수관리</Link><Link className={styles.navItem} href="/production/fattening-groups/closure"><i />그룹종료</Link><div className={styles.navSection}>출하관리</div><span className={styles.activeNav}><i />등급판정정보</span></div>
    </aside>
    {sidebarOpen ? <button className={styles.scrim} onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기" /> : null}
    <main className={styles.main}>
      <header className={styles.topbar}><button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button><div><small>현재 농장</small><strong>참든팜</strong></div><span className={styles.topbarStatus}>농장별 자동수집</span></header>
      <div className={styles.content}>
        <section className={styles.heading}><div><p>생산관리 / 출하관리</p><h1>축산물품질평가원 등급판정정보</h1><span>농장식별번호와 판정일 범위로 실제 돼지 등급판정 결과를 자동 연결합니다.</span></div><span className={styles.cycleBadge}><Link2 size={14} /> 축평원 실시간 API</span></section>
        <section className={styles.formCard}>
          <div className={styles.cardHead}><div><span className={styles.cardIcon}><ShieldCheck size={18} /></span><div><h2>등급판정정보 자동수집</h2><p>농장식별번호와 최근 이력 순번은 저장되며 인증키는 서버 환경변수에서만 사용합니다.</p></div></div><span className={styles.newBadge}>{lastSyncedAt ? "조회 이력 있음" : "연계 준비 완료"}</span></div>
          <div className={styles.formSection}><h3>조회 설정</h3><div className={styles.formGrid}>
            <label className={styles.field}><span className={styles.fieldLabel}>조회방식<b>*</b></span><select value={lookupMode} onChange={(event) => { setLookupMode(event.target.value as LookupMode); setPage(1); }}><option value="farm">농장별 자동수집</option><option value="certificate">확인서 개별조회</option></select></label>
            {lookupMode === "farm" ? <>
              <label className={styles.field}><span className={styles.fieldLabel}>농장식별번호<b>*</b></span><input inputMode="numeric" maxLength={6} value={farmId} onChange={(event) => setFarmId(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
              <label className={styles.field}><span className={styles.fieldLabel}>판정일 시작<b>*</b></span><input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} /></label>
              <label className={styles.field}><span className={styles.fieldLabel}>판정일 종료<b>*</b></span><input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} /></label>
            </> : <>
              <label className={styles.field}><span className={styles.fieldLabel}>확인서 발급번호<b>*</b></span><input maxLength={20} value={issueNo} onChange={(event) => setIssueNo(event.target.value.replace(/[^0-9A-Za-z-]/g, "").slice(0, 20))} placeholder="예: 0202-09280042" /></label>
              <label className={styles.field}><span className={styles.fieldLabel}>확인서 발급일자</span><input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></label>
            </>}
            <label className={styles.field}><span className={styles.fieldLabel}>마지막 수집일</span><input value={lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("ko-KR") : "수집 이력 없음"} readOnly /></label>
          </div><p className={styles.countValidation}>{lookupMode === "farm" ? "농장식별번호와 판정일 범위를 기준으로 필요한 돼지이력 순번을 자동 탐색합니다. 최근 확인된 순번은 다음 조회에 자동으로 사용됩니다." : "확인서 발급번호를 알고 있는 경우 상세 등급판정 결과를 바로 조회합니다."}</p></div>
          <div className={styles.formActions}><button type="button" className={styles.saveButton} onClick={syncResults} disabled={syncing}><CloudDownload size={17} /> {syncing ? "불러오는 중" : lookupMode === "farm" ? "판정일 기준 등급판정자료 조회" : "확인서 등급판정정보 조회"}</button></div>
        </section>
        <section className={styles.listCard}>
          <div className={styles.listHead}><div><h2>등급판정 결과</h2><p>축산물품질평가원에서 수집한 실제 결과를 판정일 범위에 맞춰 표시합니다.</p></div><strong>조회 {filteredRecords.length}건</strong></div>
          <div className={styles.filters}><label><span>최근 조회</span><div className={styles.dateRange}><CalendarDays size={16} /><span>{lookupSummary}</span></div></label><label className={styles.searchFilter}><span>통합검색</span><div><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="도축장, 등급, 이력번호, 확인서번호" /></div></label></div>
          <div className={styles.tableWrap}><table><thead><tr><th>판정일</th><th>성별</th><th>도축장 관리지원</th><th>도축번호</th><th>등지방</th><th>최종등급</th><th>도체중</th><th>경락가격</th><th>돼지이력번호</th><th>확인서번호</th></tr></thead><tbody>{pagedRecords.length ? pagedRecords.map((record) => <tr key={record.id}><td className={styles.cycleDate}>{record.gradeDate || "-"}</td><td>{record.sex || "-"}</td><td title={record.slaughterhouseAddress || undefined}>{record.slaughterhouseName || record.slaughterhouseCode || "-"}</td><td>{record.slaughterNo || "-"}</td><td>{record.backfat || "-"}</td><td><span className={styles.statusBadge}>{record.finalGrade || "-"}</span></td><td>{record.carcassWeight || "-"}</td><td>{record.auctionPrice || "-"}</td><td>{record.pigTraceNo || "-"}</td><td>{record.confirmationNo || "-"}</td></tr>) : <tr><td className={styles.emptyTable} colSpan={10}>농장식별번호와 판정일 범위를 선택해 등급판정자료를 조회해 주세요.</td></tr>}</tbody></table></div>
          <div className={styles.pagination}><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>이전</button>{pageNumbers.map((pageNumber) => pageNumber === currentPage ? <strong key={pageNumber}>{pageNumber}</strong> : <button type="button" key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}<button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>다음</button></div>
        </section>
      </div>
    </main>
    {notice ? <button className={styles.toast} onClick={() => setNotice("")}><span>{notice}</span><X size={15} /></button> : null}
  </div>;
}