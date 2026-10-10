import { notFound } from "next/navigation";
import BackfatLedgerPage from "../../_components/backfat-ledger-page";
import CullLedgerPage from "../../_components/cull-ledger-page";
import BoarIntakeLedgerPage from "../../_components/boar-intake-ledger-page";
import EstrusLedgerPage from "../../_components/estrus-ledger-page";
import FarrowingLedgerPage from "../../_components/farrowing-ledger-page";
import FatteningLedgerPage from "../../_components/fattening-ledger-page";
import MatingLedgerPage from "../../_components/mating-ledger-page";
import NursingPigletLedgerPage from "../../_components/nursing-piglet-ledger-page";
import PregnancyIncidentLedgerPage from "../../_components/pregnancy-incident-ledger-page";
import SowIntakeLedgerPage from "../../_components/sow-intake-ledger-page";
import WeaningLedgerPage from "../../_components/weaning-ledger-page";
import WorkLedgerPage from "../../_components/work-ledger-page";
import { workLedgerMenus, WorkLedgerMenuKey } from "../../_data/report-menus";

export function generateStaticParams() {
  return workLedgerMenus.map((menu) => ({ ledger: menu.key }));
}

export default async function LedgerPage({ params }: { params: Promise<{ ledger: string }> }) {
  const { ledger } = await params;
  if (!workLedgerMenus.some((menu) => menu.key === ledger)) notFound();
  if (ledger === "sow-intake") return <SowIntakeLedgerPage />;
  if (ledger === "boar-intake") return <BoarIntakeLedgerPage />;
  if (ledger === "estrus") return <EstrusLedgerPage />;
  if (ledger === "mating") return <MatingLedgerPage />;
  if (ledger === "pregnancy-incident") return <PregnancyIncidentLedgerPage />;
  if (ledger === "farrowing") return <FarrowingLedgerPage />;
  if (ledger === "nursing-piglets") return <NursingPigletLedgerPage />;
  if (ledger === "weaning") return <WeaningLedgerPage />;
  if (ledger === "backfat") return <BackfatLedgerPage />;
  if (ledger === "cull") return <CullLedgerPage />;
  if (ledger === "fattening") return <FatteningLedgerPage />;
  return <WorkLedgerPage ledgerKey={ledger as WorkLedgerMenuKey} />;
}