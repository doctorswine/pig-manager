import { CheckCircle2, Database, FileText, SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import styles from "../../../production/sows/intake/page.module.css";
import ReportShell from "../../_components/report-shell";
import OwnedSowsReportPage from "../../_components/owned-sows-report-page";
import SowCardReportPage from "../../_components/sow-card-report-page";
import BoarCardReportPage from "../../_components/boar-card-report-page";
import { sowListMenus } from "../../_data/report-menus";

export function generateStaticParams() {
  return sowListMenus.map((item) => ({ list: item.key }));
}

export default async function SowListPage({ params }: { params: Promise<{ list: string }> }) {
  const { list } = await params;
  const menu = sowListMenus.find((item) => item.key === list);
  if (!menu) notFound();
  if (list === "owned-sows") return <OwnedSowsReportPage />;
  if (list === "sow-card") return <SowCardReportPage />;
  if (list === "boar-card") return <BoarCardReportPage />;

  return <ReportShell>
    <section className={styles.heading}><div><p>보고서 / 모돈리스트</p><h1>{menu.label}</h1><span>{menu.description}</span></div></section>
    <section className={styles.formCard}>
      <div className={styles.cardHead}><div><span className={styles.cardIcon}><FileText size={18} /></span><div><h2>{menu.label} 보고서</h2><p>생산관리에서 기록된 개체 데이터를 기반으로 구성합니다.</p></div></div><span className={styles.newBadge}>메뉴 연결 완료</span></div>
      <div className={styles.formSection}><h3>구성 예정 항목</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, paddingBottom: 18 }}>
          {[{ icon: SlidersHorizontal, title: "조회 조건", text: "개체·상태·기간별 조회 조건" }, { icon: Database, title: "연결 데이터", text: "생산관리에서 등록한 실제 개체 기록" }, { icon: FileText, title: "출력 양식", text: "조회·인쇄·엑셀 다운로드 형식" }].map((item) => <div key={item.title} style={{ padding: 16, border: "1px solid #dce5e1", borderRadius: 12, background: "#f8faf9" }}><item.icon size={18} color="#146f5b" /><strong style={{ display: "block", marginTop: 10, fontSize: 13 }}>{item.title}</strong><span style={{ display: "block", marginTop: 5, color: "#6c7c76", fontSize: 12 }}>{item.text}</span></div>)}
        </div>
      </div>
    </section>
    <section className={styles.listCard}><div className={styles.listHead}><div><h2>{menu.label} 상세 설계</h2><p>다음 단계에서 예시 화면과 업무 기준을 확인해 항목·계산식·출력 형식을 확정합니다.</p></div><strong><CheckCircle2 size={15} style={{ verticalAlign: "middle", marginRight: 5 }} />경로 준비됨</strong></div></section>
  </ReportShell>;
}
