"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  Menu,
  PackageOpen,
  PiggyBank,
  Search,
  Settings,
  Ship,
  TrendingUp,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { reportMenus, sowListMenus, workLedgerMenus, workOrderMenus } from "./reports/_data/report-menus";

const modules = [
  { name: "모돈개체관리", description: "후보돈부터 이유까지 개체 이력", icon: PiggyBank, count: "192두" },
  { name: "웅돈개체관리", description: "웅돈 기본정보와 사용 이력", icon: Users, count: "8두" },
  { name: "비육돈그룹관리", description: "그룹별 입식과 두수 현황", icon: Warehouse, count: "3개 메뉴" },
  { name: "출하관리", description: "등급판정 결과와 출하 성적", icon: Ship, count: "eKAPE 연동" },
];

const sowMenus = ["전입관리", "초발정관리", "번식관리", "등지방관리", "도폐사관리"];
const boarMenus = ["웅돈 전입관리", "웅돈 도폐사관리"];
const fatteningGroupMenus = ["그룹등록", "두수관리", "그룹종료"];
const fatteningGroupRoutes: Record<string, string> = {
  그룹등록: "/production/fattening-groups/registration",
  두수관리: "/production/fattening-groups/movement-intake",
  그룹종료: "/production/fattening-groups/closure",
};

const tasks = [
  { type: "분만 예정 초과", animal: "모돈 23018", location: "분만사 A-12", due: "2일 지연", status: "danger" },
  { type: "임신진단", animal: "모돈 24107", location: "임신사 B-04", due: "오늘", status: "today" },
  { type: "이유 예정", animal: "모돈 22091", location: "분만사 A-03", due: "오늘", status: "today" },
  { type: "이유 후 미교배", animal: "모돈 21044", location: "교배사 C-08", due: "9일 경과", status: "warning" },
];

const monthly = [
  { month: "4월", mating: 46, farrowing: 38, weaning: 35 },
  { month: "5월", mating: 51, farrowing: 41, weaning: 39 },
  { month: "6월", mating: 44, farrowing: 40, weaning: 36 },
  { month: "7월", mating: 55, farrowing: 43, weaning: 41 },
  { month: "8월", mating: 48, farrowing: 42, weaning: 40 },
  { month: "9월", mating: 52, farrowing: 39, weaning: 37 },
];

function LogoMark() {
  return (
    <div className="logo-mark" aria-hidden="true">
      <PiggyBank size={22} strokeWidth={2.3} />
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [productionMenuOpen, setProductionMenuOpen] = useState(false);
  const [activeModule, setActiveModule] = useState("모돈개체관리");
  const [sowMenuOpen, setSowMenuOpen] = useState(true);
  const [activeSowMenu, setActiveSowMenu] = useState("전입관리");
  const [boarMenuOpen, setBoarMenuOpen] = useState(false);
  const [activeBoarMenu, setActiveBoarMenu] = useState("웅돈 전입관리");
  const [fatteningGroupMenuOpen, setFatteningGroupMenuOpen] = useState(false);
  const [activeFatteningGroupMenu, setActiveFatteningGroupMenu] = useState("그룹등록");
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [activeReportMenu, setActiveReportMenu] = useState("work-ledger");
  const [workLedgerMenuOpen, setWorkLedgerMenuOpen] = useState(false);
  const [activeWorkLedgerMenu, setActiveWorkLedgerMenu] = useState("");
  const [sowListMenuOpen, setSowListMenuOpen] = useState(false);
  const [activeSowListMenu, setActiveSowListMenu] = useState("");
  const [workOrderMenuOpen, setWorkOrderMenuOpen] = useState(false);
  const [activeWorkOrderMenu, setActiveWorkOrderMenu] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  const filteredTasks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return tasks;
    return tasks.filter((task) => `${task.type} ${task.animal} ${task.location}`.toLowerCase().includes(keyword));
  }, [query]);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="brand">
          <LogoMark />
          <div><strong>피그매니저</strong><span>PIG MANAGER</span></div>
          <button className="icon-button close-menu" onClick={() => setMenuOpen(false)} aria-label="메뉴 닫기"><X size={20} /></button>
        </div>

        <nav aria-label="주요 메뉴">
          <a className="nav-link active" href="#dashboard"><LayoutDashboard size={19} /><span>대시보드</span></a>
          <div className="nav-group">
            <button className="nav-label" type="button" onClick={() => {
              setProductionMenuOpen((isOpen) => !isOpen);
              setReportMenuOpen(false);
            }} aria-expanded={productionMenuOpen}><Activity size={19} /><span>생산관리</span><ChevronDown className={productionMenuOpen ? "rotate" : ""} size={16} /></button>
            {productionMenuOpen ? modules.map((module) => (
              <div className="sub-nav-group" key={module.name}>
                <button
                  className={`sub-nav ${activeModule === module.name ? "active" : ""}`}
                  onClick={() => {
                    setActiveModule(module.name);
                    if (module.name === "모돈개체관리") {
                      setSowMenuOpen((isOpen) => activeModule === module.name ? !isOpen : true);
                      setBoarMenuOpen(false);
                      setFatteningGroupMenuOpen(false);
                    } else if (module.name === "웅돈개체관리") {
                      setBoarMenuOpen((isOpen) => activeModule === module.name ? !isOpen : true);
                      setSowMenuOpen(false);
                      setFatteningGroupMenuOpen(false);
                    } else if (module.name === "비육돈그룹관리") {
                      setFatteningGroupMenuOpen((isOpen) => activeModule === module.name ? !isOpen : true);
                      setSowMenuOpen(false);
                      setBoarMenuOpen(false);
                    } else if (module.name === "출하관리") {
                      setSowMenuOpen(false);
                      setBoarMenuOpen(false);
                      setFatteningGroupMenuOpen(false);
                      setMenuOpen(false);
                      router.push("/production/shipping/grade-results");
                    } else {
                      setSowMenuOpen(false);
                      setBoarMenuOpen(false);
                      setFatteningGroupMenuOpen(false);
                      setMenuOpen(false);
                    }
                  }}
                  aria-expanded={module.name === "모돈개체관리" ? sowMenuOpen : module.name === "웅돈개체관리" ? boarMenuOpen : module.name === "비육돈그룹관리" ? fatteningGroupMenuOpen : undefined}
                >
                  <span>{module.name}</span>
                  {module.name === "모돈개체관리" ? (
                    <ChevronDown className={sowMenuOpen ? "rotate" : ""} size={15} />
                  ) : module.name === "웅돈개체관리" ? (
                    <ChevronDown className={boarMenuOpen ? "rotate" : ""} size={15} />
                  ) : module.name === "비육돈그룹관리" ? (
                    <ChevronDown className={fatteningGroupMenuOpen ? "rotate" : ""} size={15} />
                  ) : module.count === "준비 중" ? <small>예정</small> : null}
                </button>
                {module.name === "모돈개체관리" && activeModule === module.name && sowMenuOpen ? (
                  <div className="sow-submenu">
                    {sowMenus.map((menu) => (
                      <button
                        className={activeSowMenu === menu ? "active" : ""}
                        key={menu}
                        onClick={() => {
                          setActiveSowMenu(menu);
                          setMenuOpen(false);
                          if (menu === "전입관리") {
                            router.push("/production/sows/intake");
                          } else if (menu === "초발정관리") {
                            router.push("/production/sows/first-estrus");
                          } else if (menu === "번식관리") {
                            router.push("/production/sows/breeding/mating");
                          } else if (menu === "등지방관리") {
                            router.push("/production/sows/backfat");
                          } else if (menu === "도폐사관리") {
                            router.push("/production/sows/cull");
                          } else {
                            showNotice(`${menu} 화면은 다음 단계에서 구성합니다.`);
                          }
                        }}
                      >
                        <span aria-hidden="true" />{menu}
                      </button>
                    ))}
                  </div>
                ) : null}
                {module.name === "웅돈개체관리" && activeModule === module.name && boarMenuOpen ? (
                  <div className="sow-submenu">
                    {boarMenus.map((menu) => (
                      <button className={activeBoarMenu === menu ? "active" : ""} key={menu} onClick={() => {
                        setActiveBoarMenu(menu);
                        setMenuOpen(false);
                        router.push(menu === "웅돈 전입관리" ? "/production/boars/intake" : "/production/boars/cull");
                      }}><span aria-hidden="true" />{menu}</button>
                    ))}
                  </div>
                ) : null}
                {module.name === "비육돈그룹관리" && activeModule === module.name && fatteningGroupMenuOpen ? (
                  <div className="sow-submenu">
                    {fatteningGroupMenus.map((menu) => (
                      <button className={activeFatteningGroupMenu === menu ? "active" : ""} key={menu} onClick={() => {
                        setActiveFatteningGroupMenu(menu);
                        setMenuOpen(false);
                        router.push(fatteningGroupRoutes[menu]);
                      }}><span aria-hidden="true" />{menu}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            )) : null}
          </div>
          <a className="nav-link" href="#tasks"><ClipboardCheck size={19} /><span>작업관리</span></a>
          <div className="nav-group">
            <button className={`nav-link ${reportMenuOpen ? "active" : ""}`} type="button" onClick={() => {
              setReportMenuOpen((isOpen) => !isOpen);
              setSowMenuOpen(false);
              setBoarMenuOpen(false);
              setFatteningGroupMenuOpen(false);
            }} aria-expanded={reportMenuOpen}><TrendingUp size={19} /><span>보고서</span><ChevronDown className={reportMenuOpen ? "rotate" : ""} size={15} /></button>
            {reportMenuOpen ? <div className="sow-submenu">{reportMenus.map((menu) => <div className="report-menu-item" key={menu.key}>
              <button className={activeReportMenu === menu.key ? "active" : ""} onClick={() => {
                setActiveReportMenu(menu.key);
                if (menu.key === "work-ledger") {
                  setWorkLedgerMenuOpen((isOpen) => !isOpen);
                  setSowListMenuOpen(false);
                  setWorkOrderMenuOpen(false);
                  router.push(menu.route);
                } else if (menu.key === "sow-list") {
                  setSowListMenuOpen((isOpen) => !isOpen);
                  setWorkLedgerMenuOpen(false);
                  setWorkOrderMenuOpen(false);
                  router.push(menu.route);
                } else if (menu.key === "work-orders") {
                  setWorkOrderMenuOpen((isOpen) => !isOpen);
                  setWorkLedgerMenuOpen(false);
                  setSowListMenuOpen(false);
                  router.push(menu.route);
                } else {
                  setWorkLedgerMenuOpen(false);
                  setSowListMenuOpen(false);
                  setWorkOrderMenuOpen(false);
                  setMenuOpen(false);
                  router.push(menu.route);
                }
              }} aria-expanded={menu.key === "work-ledger" ? workLedgerMenuOpen : menu.key === "sow-list" ? sowListMenuOpen : menu.key === "work-orders" ? workOrderMenuOpen : undefined}><span aria-hidden="true" />{menu.label}{menu.key === "work-ledger" ? <ChevronDown className={workLedgerMenuOpen ? "rotate" : ""} size={13} /> : menu.key === "sow-list" ? <ChevronDown className={sowListMenuOpen ? "rotate" : ""} size={13} /> : menu.key === "work-orders" ? <ChevronDown className={workOrderMenuOpen ? "rotate" : ""} size={13} /> : null}</button>
              {menu.key === "work-ledger" && workLedgerMenuOpen ? <div className="ledger-submenu">{workLedgerMenus.map((ledger) => <button className={activeWorkLedgerMenu === ledger.key ? "active" : ""} key={ledger.key} onClick={() => {
                setActiveWorkLedgerMenu(ledger.key);
                setMenuOpen(false);
                router.push(ledger.route);
              }}><span aria-hidden="true" />{ledger.label}</button>)}</div> : null}
              {menu.key === "sow-list" && sowListMenuOpen ? <div className="ledger-submenu">{sowListMenus.map((item) => <button className={activeSowListMenu === item.key ? "active" : ""} key={item.key} onClick={() => {
                setActiveSowListMenu(item.key);
                setMenuOpen(false);
                router.push(item.route);
              }}><span aria-hidden="true" />{item.label}</button>)}</div> : null}
              {menu.key === "work-orders" && workOrderMenuOpen ? <div className="ledger-submenu">{workOrderMenus.filter((item) => item.key !== "weekly-status").map((item) => <button className={activeWorkOrderMenu === item.key ? "active" : ""} key={item.key} onClick={() => {
                setActiveWorkOrderMenu(item.key);
                setMenuOpen(false);
                router.push(item.route);
              }}><span aria-hidden="true" />{item.label}</button>)}</div> : null}
            </div>)}</div> : null}
          </div>
          <a className="nav-link" href="#settings"><Settings size={19} /><span>농장 설정</span></a>
        </nav>

        <div className="sidebar-foot">
          <span className="status-dot" />
          <div><strong>데이터 연결 준비 중</strong><span>현재 화면은 예시 데이터입니다</span></div>
        </div>
      </aside>

      {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="메뉴 닫기" />}

      <main id="dashboard">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="메뉴 열기"><Menu size={22} /></button>
          <div className="farm-select">
            <span>현재 농장</span>
            <button>해솔 번식농장 <ChevronDown size={15} /></button>
          </div>
          <div className="search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="모돈번호, 작업, 돈사 검색" aria-label="모돈번호, 작업, 돈사 검색" />
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="알림"><Bell size={20} /><span className="notification-dot" /></button>
            <button className="profile-button"><span>김</span><div><strong>김관리</strong><small>농장 관리자</small></div></button>
          </div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">2026년 9월 19일 · 토요일</p>
              <h1>농장 현황</h1>
              <p>오늘 필요한 작업부터 확인하세요.</p>
            </div>
            <div className="last-records" aria-label="최근 기록일">
              <span><b>교배</b> 09.16</span><span><b>분만</b> 09.15</span><span><b>이유</b> 09.16</span>
            </div>
          </section>

          <section className="summary-grid" aria-label="오늘 작업 요약">
            <button className="summary-card danger" onClick={() => showNotice("지연 작업 10건을 불러왔습니다.")}>
              <span className="summary-icon"><AlertTriangle size={20} /></span>
              <span><small>지연 작업</small><strong>10<em>건</em></strong></span>
              <span className="summary-meta">어제보다 2건 증가</span><ArrowRight size={18} />
            </button>
            <button className="summary-card today" onClick={() => showNotice("오늘 예정 작업 18건을 불러왔습니다.")}>
              <span className="summary-icon"><CalendarDays size={20} /></span>
              <span><small>오늘 예정</small><strong>18<em>건</em></strong></span>
              <span className="summary-meta">분만 3 · 이유 5</span><ArrowRight size={18} />
            </button>
            <button className="summary-card done" onClick={() => showNotice("오늘 완료한 작업은 12건입니다.")}>
              <span className="summary-icon"><ClipboardCheck size={20} /></span>
              <span><small>오늘 완료</small><strong>12<em>건</em></strong></span>
              <span className="summary-meta">완료율 40%</span><ArrowRight size={18} />
            </button>
            <button className="quick-record" onClick={() => showNotice("빠른 기록 화면은 다음 단계에서 연결합니다.")}>
              <span><strong>빠른 기록</strong><small>교배 · 임신진단 · 분만 · 이유</small></span><span className="quick-plus">+</span>
            </button>
          </section>

          <section className="module-section">
            <div className="section-title"><div><h2>생산관리</h2><p>관리할 영역을 선택하세요.</p></div><span className="demo-badge">구조 확정</span></div>
            <div className="module-grid">
              {modules.map(({ name, description, icon: Icon, count }, index) => (
                <button
                  className={`module-card ${activeModule === name ? "selected" : ""}`}
                  key={name}
                  onClick={() => {
                    setActiveModule(name);
                    setSowMenuOpen(name === "모돈개체관리");
                    setBoarMenuOpen(name === "웅돈개체관리");
                    setFatteningGroupMenuOpen(name === "비육돈그룹관리");
                    if (name === "출하관리") router.push("/production/shipping/grade-results");
                  }}
                >
                  <span className="module-number">0{index + 1}</span>
                  <span className="module-icon"><Icon size={22} /></span>
                  <span className="module-copy"><strong>{name}</strong><small>{description}</small></span>
                  <span className={`module-count ${count === "준비 중" ? "muted" : ""}`}>{count}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="workspace-grid">
            <article className="panel task-panel" id="tasks">
              <div className="panel-head"><div><h2>관리 필요 모돈</h2><p>긴급도와 예정일 순으로 정렬했습니다.</p></div><button onClick={() => setQuery("")}>전체 보기 <ArrowRight size={16} /></button></div>
              <div className="task-list">
                {filteredTasks.length ? filteredTasks.map((task) => (
                  <button className="task-row" key={`${task.type}-${task.animal}`} onClick={() => showNotice(`${task.animal} 상세 화면은 다음 단계에서 연결합니다.`)}>
                    <span className={`task-status ${task.status}`} />
                    <span className="task-main"><strong>{task.type}</strong><small>{task.animal} · {task.location}</small></span>
                    <span className={`due-badge ${task.status}`}>{task.due}</span><ArrowRight size={17} />
                  </button>
                )) : <div className="empty-state"><PackageOpen size={28} /><strong>검색 결과가 없습니다</strong><span>다른 모돈번호나 돈사를 입력해 보세요.</span></div>}
              </div>
            </article>

            <article className="panel status-panel">
              <div className="panel-head"><div><h2>번식 현황</h2><p>현재 모돈 192두</p></div><button onClick={() => showNotice("모돈개체관리 목록은 다음 단계에서 연결합니다.")}>모돈 보기 <ArrowRight size={16} /></button></div>
              <div className="status-chart" aria-label="상태별 모돈 두수">
                {[
                  ["후보", 18, "#93a99d"], ["공태", 12, "#e0a35b"], ["교배", 34, "#63a68a"], ["임신", 86, "#167a62"], ["포유", 42, "#0f5549"],
                ].map(([label, value, color]) => (
                  <div className="status-bar" key={String(label)}>
                    <div className="status-value"><span>{label}</span><strong>{value}두</strong></div>
                    <div className="bar-track"><span style={{ width: `${Number(value) / 86 * 100}%`, backgroundColor: String(color) }} /></div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="kpi-section" id="reports">
            <div className="section-title"><div><h2>핵심 생산지표</h2><p>최근 6개월 · 농장 목표 대비</p></div><button className="period-button"><CalendarDays size={16} /> 최근 6개월 <ChevronDown size={14} /></button></div>
            <div className="kpi-grid">
              {[
                ["분만율", "84.6", "%", "+1.8", "up"], ["복당 총산", "14.8", "두", "+0.6", "up"], ["복당 생존산자", "13.7", "두", "+0.3", "up"], ["복당 이유두수", "11.2", "두", "-0.2", "down"],
              ].map(([label, value, unit, delta, direction]) => (
                <div className="kpi-card" key={label}>
                  <div><span>{label}</span><small className={direction}>{delta} 목표 대비</small></div>
                  <strong>{value}<em>{unit}</em></strong>
                </div>
              ))}
            </div>
          </section>

          <section className="panel trend-panel">
            <div className="panel-head"><div><h2>월별 번식 흐름</h2><p>교배·분만·이유 복수</p></div><div className="legend"><span className="mating">교배</span><span className="farrowing">분만</span><span className="weaning">이유</span></div></div>
            <div className="trend-chart" role="img" aria-label="최근 6개월 교배 분만 이유 복수 비교">
              {monthly.map((item) => (
                <div className="month-group" key={item.month}>
                  <div className="bars">
                    <span className="bar mating" style={{ height: `${item.mating * 2.2}px` }} title={`교배 ${item.mating}복`} />
                    <span className="bar farrowing" style={{ height: `${item.farrowing * 2.2}px` }} title={`분만 ${item.farrowing}복`} />
                    <span className="bar weaning" style={{ height: `${item.weaning * 2.2}px` }} title={`이유 ${item.weaning}복`} />
                  </div><span>{item.month}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
