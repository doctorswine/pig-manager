"use client";

import { ArrowLeft, ChevronDown, Menu, PiggyBank, Users, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import styles from "../../sows/intake/page.module.css";

type BoarManagementShellProps = {
  active: "intake" | "cull";
};

const pageCopy = {
  intake: {
    title: "웅돈 전입관리",
    description: "새로 들어온 웅돈의 기본정보와 전입 이력을 관리합니다.",
    cardTitle: "웅돈 전입 기록",
    pending: "전입 입력 항목과 목록 구성은 다음 예시를 기준으로 확정합니다.",
  },
  cull: {
    title: "웅돈 도폐사관리",
    description: "웅돈의 도태·폐사·전출·판매 이력을 관리합니다.",
    cardTitle: "웅돈 도폐사 기록",
    pending: "도폐사 입력 항목과 목록 구성은 다음 예시를 기준으로 확정합니다.",
  },
} as const;

export default function BoarManagementShell({ active }: BoarManagementShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const copy = pageCopy[active];

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
        {active === "intake" ? <span className={styles.activeNav}><i />웅돈 전입관리</span> : <Link className={styles.navItem} href="/production/boars/intake"><i />웅돈 전입관리</Link>}
        {active === "cull" ? <span className={styles.activeNav}><i />웅돈 도폐사관리</span> : <Link className={styles.navItem} href="/production/boars/cull"><i />웅돈 도폐사관리</Link>}
      </div>
    </aside>
    {sidebarOpen ? <button className={styles.scrim} aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /> : null}

    <main className={styles.main}>
      <header className={styles.topbar}><button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button><div><small>현재 농장</small><strong>해솔 번식농장</strong></div><span className={styles.topbarStatus}>화면 구조 준비</span></header>
      <div className={styles.content}>
        <section className={styles.heading}><div><p>생산관리 / 웅돈개체관리</p><h1>{copy.title}</h1><span>{copy.description}</span></div></section>
        <nav className={styles.breedingTabs} style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }} aria-label="웅돈개체관리 하위 메뉴">
          <Link className={active === "intake" ? styles.activeBreedingTab : ""} href="/production/boars/intake">웅돈 전입관리</Link>
          <Link className={active === "cull" ? styles.activeBreedingTab : ""} href="/production/boars/cull">웅돈 도폐사관리</Link>
        </nav>
        <section className={styles.formCard}>
          <div className={styles.cardHead}><div><span className={styles.cardIcon}><Users size={18} /></span><div><h2>{copy.cardTitle}</h2><p>현재는 메뉴와 페이지 구조만 구성한 상태입니다.</p></div></div><span className={styles.newBadge}>구조확정</span></div>
          <div className={styles.formSection}><h3>다음 작업</h3><div className={styles.calculatedField}>{copy.pending}</div></div>
        </section>
      </div>
    </main>
  </div>;
}
