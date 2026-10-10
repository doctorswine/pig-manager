import { notFound } from "next/navigation";
import ReportPlaceholder from "../../_components/report-placeholder";
import { fatteningReportMenus } from "../../_data/report-menus";

export function generateStaticParams() { return fatteningReportMenus.map((item) => ({ report: item.key })); }

export default async function Page({ params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  const menu = fatteningReportMenus.find((item) => item.key === report);
  if (!menu) notFound();
  return <ReportPlaceholder breadcrumb="보고서 / 비육돈" title={menu.label} description={menu.description} />;
}
