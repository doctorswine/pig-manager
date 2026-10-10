import { notFound } from "next/navigation";
import ReportPlaceholder from "../../_components/report-placeholder";
import { matingReportMenus } from "../../_data/report-menus";

export function generateStaticParams() { return matingReportMenus.map((item) => ({ report: item.key })); }

export default async function Page({ params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  const menu = matingReportMenus.find((item) => item.key === report);
  if (!menu) notFound();
  return <ReportPlaceholder breadcrumb="보고서 / 교배" title={menu.label} description={menu.description} />;
}
