"use client";

import { ArrowLeft, BarChart3, ChevronDown, Menu, PiggyBank, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import styles from "../../production/sows/intake/page.module.css";
import { reportMenus, sowListMenus, workLedgerMenus, workOrderMenus } from "../_data/report-menus";

const breedingLedgerTabs = [
  { label: "교배대장", route: "/reports/work-ledger/mating" },
  { label: "임신사고대장", route: "/reports/work-ledger/pregnancy-incident" },
  { label: "분만대장", route: "/reports/work-ledger/farrowing" },
  { label: "포유자돈대장", route: "/reports/work-ledger/nursing-piglets" },
  { label: "이유대장", route: "/reports/work-ledger/weaning" },
] as const;

const hiddenBreedingLedgerKeys = new Set(["pregnancy-incident", "farrowing", "nursing-piglets", "weaning"]);

export default function ReportShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isWorkLedger = pathname.startsWith("/reports/work-ledger");
  const isSowList = pathname.startsWith("/reports/sow-list");
  const isWorkOrders = pathname.startsWith("/reports/work-orders");
  const showBreedingLedgerTabs = breedingLedgerTabs.some((tab) => tab.route === pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workLedgerOpen, setWorkLedgerOpen] = useState(isWorkLedger);
  const [sowListOpen, setSowListOpen] = useState(isSowList);
  const [workOrdersOpen, setWorkOrdersOpen] = useState(isWorkOrders);

  useEffect(() => {
    if (isWorkLedger) setWorkLedgerOpen(true);
  }, [isWorkLedger]);

  useEffect(() => {
    if (isSowList) setSowListOpen(true);
  }, [isSowList]);

  useEffect(() => {
    if (isWorkOrders) setWorkOrdersOpen(true);
  }, [isWorkOrders]);

  return <div className={styles.shell}>
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
      <div className={styles.brand}><span><PiggyBank size={21} /></span><strong>피그매니저</strong><button onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기"><X size={19} /></button></div>
      <Link className={styles.backLink} href="/"><ArrowLeft size={17} /> 대시보드</Link>
      <div className={styles.navGroup}>
        <div className={styles.navTitle}><span>보고서</span><BarChart3 size={16} /></div>
        {reportMenus.map((menu) => menu.key === "work-ledger" ? <div key={menu.key}>
          <Link href={menu.route} className={isWorkLedger ? styles.activeNav : styles.navItem} onClick={() => setWorkLedgerOpen((open) => !open)} aria-expanded={workLedgerOpen}>
            <i />{menu.label}<ChevronDown className={`${styles.navChevron} ${workLedgerOpen ? styles.navChevronOpen : ""}`} size={14} />
          </Link>
          {workLedgerOpen ? <div className={styles.nestedNav}>
            {workLedgerMenus.filter((ledger) => !hiddenBreedingLedgerKeys.has(ledger.key)).map((ledger) => <Link key={ledger.key} href={ledger.route} className={pathname === ledger.route || (ledger.key === "mating" && showBreedingLedgerTabs) ? styles.activeNav : styles.navItem} onClick={() => setSidebarOpen(false)}><i />{ledger.label}</Link>)}
          </div> : null}
        </div> : menu.key === "sow-list" ? <div key={menu.key}>
          <Link href={menu.route} className={isSowList ? styles.activeNav : styles.navItem} onClick={() => setSowListOpen((open) => !open)} aria-expanded={sowListOpen}>
            <i />{menu.label}<ChevronDown className={`${styles.navChevron} ${sowListOpen ? styles.navChevronOpen : ""}`} size={14} />
          </Link>
          {sowListOpen ? <div className={styles.nestedNav}>
            {sowListMenus.map((item) => <Link key={item.key} href={item.route} className={pathname === item.route ? styles.activeNav : styles.navItem} onClick={() => setSidebarOpen(false)}><i />{item.label}</Link>)}
          </div> : null}
        </div> : menu.key === "work-orders" ? <div key={menu.key}>
          <Link href={menu.route} className={isWorkOrders ? styles.activeNav : styles.navItem} onClick={() => setWorkOrdersOpen((open) => !open)} aria-expanded={workOrdersOpen}>
            <i />{menu.label}<ChevronDown className={`${styles.navChevron} ${workOrdersOpen ? styles.navChevronOpen : ""}`} size={14} />
          </Link>
          {workOrdersOpen ? <div className={styles.nestedNav}>{workOrderMenus.filter((item) => item.key !== "weekly-status").map((item) => <Link key={item.key} href={item.route} className={pathname === item.route ? styles.activeNav : styles.navItem} onClick={() => setSidebarOpen(false)}><i />{item.label}</Link>)}</div> : null}
        </div> : <Link key={menu.key} href={menu.route} className={pathname === menu.route ? styles.activeNav : styles.navItem} onClick={() => setSidebarOpen(false)}><i />{menu.label}</Link>)}
      </div>
    </aside>
    {sidebarOpen ? <button className={styles.scrim} onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기" /> : null}
    <main className={styles.main}>
      <header className={styles.topbar}><button className={styles.menuButton} onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button><div><small>현재 농장</small><strong>참든팜</strong></div><span className={styles.topbarStatus}>보고서</span></header>
      <div className={styles.content}>
        {showBreedingLedgerTabs ? <nav className={`${styles.breedingTabs} ${styles.printHidden}`} aria-label="번식 작업대장 구분">{breedingLedgerTabs.map((tab) => <Link key={tab.route} href={tab.route} className={pathname === tab.route ? styles.activeBreedingTab : undefined}>{tab.label}</Link>)}</nav> : null}
        {children}
      </div>
    </main>
  </div>;
}
