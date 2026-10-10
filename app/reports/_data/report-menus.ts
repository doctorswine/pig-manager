import { ClipboardList, FileCheck2, ListChecks, PiggyBank, Presentation, Ship, TrendingUp, Warehouse } from "lucide-react";

export const reportMenus = [
  { key: "work-ledger", label: "작업대장", route: "/reports/work-ledger", description: "기간별 생산 작업 기록을 한 번에 조회합니다.", icon: ClipboardList },
  { key: "sow-list", label: "모돈리스트", route: "/reports/sow-list", description: "모돈 기본정보와 현재 번식 상태를 확인합니다.", icon: PiggyBank },
  { key: "work-orders", label: "작업지시서", route: "/reports/work-orders", description: "예정 작업과 담당자별 실행 항목을 정리합니다.", icon: ListChecks },
  { key: "mating", label: "교배", route: "/reports/mating", description: "교배 실적과 재발·수태 관련 지표를 분석합니다.", icon: FileCheck2 },
  { key: "farrowing", label: "분만", route: "/reports/farrowing", description: "분만 실적과 산자 성적을 기간별로 분석합니다.", icon: Presentation },
  { key: "production-analysis", label: "생산분석", route: "/reports/production-analysis", description: "번식돈 생산지표와 추세를 종합 분석합니다.", icon: TrendingUp },
  { key: "fattening", label: "비육돈", route: "/reports/fattening", description: "비육돈 그룹별 두수 변화와 폐사·전출 성적을 확인합니다.", icon: Warehouse },
  { key: "shipping-analysis", label: "출하분석", route: "/reports/shipping-analysis", description: "출하 및 eKAPE 등급판정 성적을 분석합니다.", icon: Ship },
] as const;

export const workLedgerMenus = [
  { key: "sow-intake", label: "모돈전입대장", route: "/reports/work-ledger/sow-intake" },
  { key: "boar-intake", label: "웅돈전입대장", route: "/reports/work-ledger/boar-intake" },
  { key: "estrus", label: "초발정대장", route: "/reports/work-ledger/estrus" },
  { key: "mating", label: "번식대장", route: "/reports/work-ledger/mating" },
  { key: "pregnancy-incident", label: "임신진단 사고대장", route: "/reports/work-ledger/pregnancy-incident" },
  { key: "farrowing", label: "분만대장", route: "/reports/work-ledger/farrowing" },
  { key: "nursing-piglets", label: "포유자돈대장", route: "/reports/work-ledger/nursing-piglets" },
  { key: "weaning", label: "이유대장", route: "/reports/work-ledger/weaning" },
  { key: "backfat", label: "등지방 대장", route: "/reports/work-ledger/backfat" },
  { key: "cull", label: "도폐사 대장", route: "/reports/work-ledger/cull" },
  { key: "fattening", label: "비육돈 작업대장", route: "/reports/work-ledger/fattening" },
] as const;

// 번식대장 단계(임신사고·분만·포유자돈·이유)는 사이드바에 표시하지 않고 번식대장 상단 탭으로만 이동한다.
export const hiddenBreedingLedgerKeys: ReadonlySet<string> = new Set(["pregnancy-incident", "farrowing", "nursing-piglets", "weaning"]);
export const sidebarWorkLedgerMenus = workLedgerMenus.filter((menu) => !hiddenBreedingLedgerKeys.has(menu.key));

export const sowListMenus = [
  { key: "owned-sows", label: "보유모돈", route: "/reports/sow-list/owned-sows", description: "현재 농장에서 보유 중인 모돈 현황을 확인합니다." },
  { key: "sow-card", label: "모돈카드", route: "/reports/sow-list/sow-card", description: "모돈별 기본정보와 생산 이력을 카드 형태로 확인합니다." },
  { key: "boar-card", label: "웅돈카드", route: "/reports/sow-list/boar-card", description: "웅돈별 기본정보와 사용 이력을 카드 형태로 확인합니다." },
] as const;

export const workOrderMenus = [
  { key: "daily-summary", label: "종합일보", route: "/reports/work-orders/daily-summary", description: "일자별 생산 작업과 주요 현황을 종합합니다." },
  { key: "weekly-status", label: "종합주보", route: "/reports/work-orders/weekly-status", description: "주차별 번식 작업과 생산지표를 종합합니다." },
  { key: "cull-candidates", label: "도태 기준모돈 산출", route: "/reports/work-orders/cull-candidates", description: "도태 기준에 해당하는 관리 대상 모돈을 산출합니다." },
  { key: "farrowing-due", label: "분만 예정돈", route: "/reports/work-orders/farrowing-due", description: "교배 기록을 기준으로 분만 예정 모돈을 조회합니다." },
  { key: "sows-needing-care", label: "관리대상모돈", route: "/reports/work-orders/sows-needing-care", description: "번식 흐름에서 확인이 필요한 모돈을 정리합니다." },
  { key: "scheduled-work", label: "작업예정돈", route: "/reports/work-orders/scheduled-work", description: "기간별 예정 작업과 대상 모돈을 조회합니다." },
  { key: "sow-cull-analysis", label: "모돈 도폐사 원인분석", route: "/reports/work-orders/sow-cull-analysis", description: "모돈 도태·폐사 원인을 구분별로 분석합니다." },
] as const;

// 보고서 > 교배, 비육돈 하위 메뉴(작업지시서에서 이동)
export const matingReportMenus = [
  { key: "mating-results", label: "교배실적", route: "/reports/mating/mating-results", description: "기간별 교배 두수와 후보돈·경산돈·재교배 실적을 확인합니다." },
  { key: "mating-target", label: "교배목표 달성율", route: "/reports/mating/mating-target", description: "기간별 교배 목표와 실제 달성률을 비교합니다." },
  { key: "pregnancy-incident-analysis", label: "임신사고 원인분석", route: "/reports/mating/pregnancy-incident-analysis", description: "재발·불임·유산 등 임신사고를 원인별로 분석합니다." },
  { key: "non-productive-days", label: "비생산일수 분석", route: "/reports/mating/non-productive-days", description: "이유·사고 후 재교배까지의 비생산일수를 분석합니다." },
  { key: "first-mating-age", label: "초교배 일령별 성적", route: "/reports/mating/first-mating-age", description: "후보돈 초교배 일령 구간별 분만·산자 성적을 비교합니다." },
  { key: "return-to-estrus", label: "재귀발정분석", route: "/reports/mating/return-to-estrus", description: "이유 후 재귀발정(재교배)까지 걸린 일수를 분석합니다." },
  { key: "repeat-estrus", label: "재발정분석", route: "/reports/mating/repeat-estrus", description: "교배 후 재발정(재발) 발생 시기와 비율을 분석합니다." },
] as const;

export const fatteningReportMenus = [
  { key: "fattening-weekly", label: "비육돈 주차별 현황", route: "/reports/fattening/fattening-weekly", description: "비육돈 그룹의 주차별 두수 변화를 확인합니다." },
] as const;

export type ReportMenuKey = typeof reportMenus[number]["key"];
export type WorkLedgerMenuKey = typeof workLedgerMenus[number]["key"];
export type SowListMenuKey = typeof sowListMenus[number]["key"];
export type WorkOrderMenuKey = typeof workOrderMenus[number]["key"];
