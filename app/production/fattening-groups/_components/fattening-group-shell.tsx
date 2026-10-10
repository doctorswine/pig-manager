"use client";

import { ArrowLeft, ChevronDown, Menu, PiggyBank, Warehouse, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import styles from "../../../production/sows/intake/page.module.css";

export type FatteningGroupSection = "registration" | "movement-intake" | "mortality" | "outbound" | "closure";

type FatteningGroupShellProps = {
  active: FatteningGroupSection;
};

const sections: Array<{ key: FatteningGroupSection; label: string; href: string }> = [
  { key: "registration", label: "그룹등록", href: "/production/fattening-groups/registration" },
  { key: "movement-intake", label: "두수관리", href: "/production/fattening-groups/movement-intake" },
  { key: "closure", label: "그룹종료", href: "/production/fattening-groups/closure" },
];

const pageCopy: Record<FatteningGroupSection, { title: string; description: string; pending: string }> = {
  registration: {
    title: "그룹등록",
    description: "비육돈 그룹의 기본정보와 최초 입식 내용을 등록합니다.",
    pending: "그룹등록 입력 항목과 목록 규칙은 다음 예시를 기준으로 확정합니다.",
  },
  "movement-intake": {
    title: "이동전입",
    description: "기존 비육돈 그룹으로 이동하거나 전입한 두수를 기록합니다.",
    pending: "이동전입 입력 항목과 두수 반영 규칙은 이후 예시를 기준으로 확정합니다.",
  },
  mortality: {
    title: "폐사기록",
    description: "비육돈 그룹에서 발생한 폐사 내역을 기록합니다.",
    pending: "폐사기록 입력 항목과 원인 분류는 이후 예시를 기준으로 확정합니다.",
  },
  outbound: {
    title: "전출/출하 기록",
    description: "비육돈 그룹의 전출과 출하 이력을 관리합니다.",
    pending: "전출·출하 입력 항목과 두수·중량 계산 규칙은 이후 예시를 기준으로 확정합니다.",
  },
  closure: {
    title: "그룹종료",
    description: "모든 이동과 출하가 끝난 비육돈 그룹을 종료합니다.",
    pending: "그룹종료 조건과 잔여두수 검증 규칙은 이후 예시를 기준으로 확정합니다.",
  },
};

export default function FatteningGroupShell({ active }: FatteningGroupShellProps) {
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
        <Link className={styles.navItem} href="/production/boars/intake"><i />웅돈 전입관리</Link>
        <Link className={styles.navItem} href="/production/boars/cull"><i />웅돈 도폐사관리</Link>
        <div className={styles.navSection}>비육돈그룹관리</div>
        {sections.map((section) => section.key === active
          ? <span className={styles.activeNav} key={section.key}><i />{section.label}</span>
          : <Link className={styles.navItem} href={section.href} key={section.key}><i />{section.label}</Link>)}
      </div>
    </aside>
    {sidebarOpen ? <button className={styles.scrim} aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /> : null}

    <main className={styles.main}>
      <header className={styles.topbar}><button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button><div><small>현재 농장</small><strong>해솔 번식농장</strong></div><span className={styles.topbarStatus}>화면 구조 준비</span></header>
      <div className={styles.content}>
        <section className={styles.heading}><div><p>생산관리 / 비육돈그룹관리</p><h1>{copy.title}</h1><span>{copy.description}</span></div></section>
        <nav className={`${styles.breedingTabs} ${styles.compactTabs}`} aria-label="비육돈그룹관리 하위 메뉴">
          {sections.map((section) => <Link className={section.key === active ? styles.activeBreedingTab : ""} href={section.href} key={section.key}>{section.label}</Link>)}
        </nav>
        <section className={styles.formCard}>
          <div className={styles.cardHead}><div><span className={styles.cardIcon}><Warehouse size={18} /></span><div><h2>{copy.title}</h2><p>현재는 메뉴와 페이지 구조만 구성한 상태입니다.</p></div></div><span className={styles.newBadge}>구조확정</span></div>
          <div className={styles.formSection}><h3>다음 작업</h3><div className={styles.calculatedField}>{copy.pending}</div></div>
        </section>
      </div>
    </main>
  </div>;
}
