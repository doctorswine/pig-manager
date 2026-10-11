import { notFound } from "next/navigation";
import MatingGroupReportPage from "../../_components/mating-group-report-page";
import MatingResultsReportPage from "../../_components/mating-results-report-page";
import MatingTargetReportPage from "../../_components/mating-target-report-page";
import NonProductiveDaysReportPage from "../../_components/non-productive-days-report-page";
import PregnancyIncidentReportPage from "../../_components/pregnancy-incident-report-page";
import ReportPlaceholder from "../../_components/report-placeholder";
import { matingReportMenus } from "../../_data/report-menus";

export function generateStaticParams() { return matingReportMenus.map((item) => ({ report: item.key })); }

export default async function Page({ params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  const menu = matingReportMenus.find((item) => item.key === report);
  if (!menu) notFound();
  if (report === "mating-results") return <MatingResultsReportPage />;
  if (report === "mating-target") return <MatingTargetReportPage />;
  if (report === "mating-group-results") return <MatingGroupReportPage />;
  if (report === "pregnancy-incident-analysis") return <PregnancyIncidentReportPage />;
  if (report === "non-productive-days") return <NonProductiveDaysReportPage />;
  return <ReportPlaceholder breadcrumb="보고서 / 교배" title={menu.label} description={menu.description} />;
}
