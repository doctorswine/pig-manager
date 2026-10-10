import { CheckCircle2, ClipboardList, Database, SlidersHorizontal } from "lucide-react";
import styles from "../../production/sows/intake/page.module.css";
import ReportShell from "./report-shell";

// 상세 양식을 아직 확정하지 않은 보고서의 공통 자리표시 화면
export default function ReportPlaceholder({ breadcrumb, title, description }: { breadcrumb: string; title: string; description: string }) {
  return <ReportShell>
    <section className={styles.heading}><div><p>{breadcrumb}</p><h1>{title}</h1><span>{description}</span></div></section>
    <section className={styles.formCard}><div className={styles.cardHead}><div><span className={styles.cardIcon}><ClipboardList size={18} /></span><div><h2>{title}</h2><p>생산관리에서 기록된 데이터를 기반으로 구성합니다.</p></div></div><span className={styles.newBadge}>메뉴 연결 완료</span></div><div className={styles.formSection}><h3>구성 예정 항목</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, paddingBottom: 18 }}>{[{ icon: SlidersHorizontal, title: "조회 조건", text: "기간·상태·개체 또는 그룹 조건" }, { icon: Database, title: "연결 데이터", text: "생산관리에서 등록한 실제 기록" }, { icon: ClipboardList, title: "작업·분석 결과", text: "대상 목록·합계·핵심 지표" }].map((item) => <div key={item.title} style={{ padding: 16, border: "1px solid #dce5e1", borderRadius: 12, background: "#f8faf9" }}><item.icon size={18} color="#146f5b" /><strong style={{ display: "block", marginTop: 10, fontSize: 13 }}>{item.title}</strong><span style={{ display: "block", marginTop: 5, color: "#6c7c76", fontSize: 12 }}>{item.text}</span></div>)}</div></div></section>
    <section className={styles.listCard}><div className={styles.listHead}><div><h2>{title} 상세 설계</h2><p>다음 단계에서 예시 화면과 업무 기준을 받아 조회·계산·출력 형식을 확정합니다.</p></div><strong><CheckCircle2 size={15} style={{ verticalAlign: "middle", marginRight: 5 }} />경로 준비됨</strong></div></section>
  </ReportShell>;
}
