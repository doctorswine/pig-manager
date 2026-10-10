import type { SowCullRecord as CullRecord } from "../../production/sows/_data/cull-records";
import type { FarrowingRecord } from "../../production/sows/_data/farrowing-records";
import type { MatingRecord } from "../../production/sows/_data/mating-records";
import type { PregnancyIncidentRecord } from "../../production/sows/_data/pregnancy-incident-records";
import type { WeaningRecord } from "../../production/sows/_data/weaning-records";
import type { MatingPeriod } from "./mating-results";

// 교배그룹별 생산성적(피그플랜 양식): 구간(교배그룹)마다 그 구간에 교배한 모돈의 결과를 따라간다.
const EXPECTED_FARROWING_OFFSET = 114; // 교배일 1일차 기준 115일째
export const INCIDENT_WEEKS = 17; // 교배 후 사고 발생 주차 1~17주

type Outcome = {
  mating: MatingRecord;
  incident?: { date: string; cause: string; days: number; week: number; column: "재발" | "유산" | "도태" | "폐사" };
  removed?: { date: string; type: string }; // 임신 중 전출·판매(사고 기록 없음)
  farrowing?: FarrowingRecord; weaning?: WeaningRecord; nextMatingDays?: number;
  pending: boolean; overdue: boolean;
};

export type GroupRow = {
  label: string; group: string; start: string; end: string; matings: number;
  incidents: Record<"재발" | "유산" | "도태" | "폐사", number>; removed: number; incidentDays: number | null;
  farrowingRange: string; farrowings: number; parity: number | null; farrowingRate: number | null; gestation: number | null;
  totalBorn: number; avgTotalBorn: number | null; mummified: number; stillborn: number; liveBorn: number; avgLiveBorn: number | null;
  weanedSows: number; fosterWeaned: number; weaned: number; weanedPerLitter: number | null; weaningAge: number | null; rematedSows: number; returnDays: number | null;
};
export type WeeklyRow = { label: string; start: string; end: string; matings: number; byWeek: number[]; pending: number; farrowings: number; farrowingRate: number | null; overdue: number; removed: number };

function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); }
function addDays(text: string, days: number) { const date = new Date(`${text}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function avg(values: number[], digits = 1) { if (!values.length) return null; const factor = 10 ** digits; return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * factor) / factor; }
function rate(part: number, whole: number) { return whole ? Math.round((part / whole) * 1000) / 10 : null; }
// 일요일 시작 주차(1월 1일이 든 주가 1주차) — 피그플랜 교배그룹 번호와 같다.
export function weekNumber(text: string) {
  const date = new Date(`${text}T00:00:00Z`); const year = date.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1)); const firstSunday = new Date(jan1); firstSunday.setUTCDate(1 - jan1.getUTCDay());
  return { year, week: Math.floor((date.getTime() - firstSunday.getTime()) / (7 * 86400000)) + 1 };
}
function incidentColumn(cause: string): "재발" | "유산" | "도태" | "폐사" { if (cause === "유산") return "유산"; if (cause === "도태") return "도태"; if (cause === "폐사") return "폐사"; return "재발"; }

function outcomes(cohort: MatingRecord[], all: MatingRecord[], incidents: PregnancyIncidentRecord[], culls: CullRecord[], farrowings: FarrowingRecord[], weanings: WeaningRecord[], endDate: string): Outcome[] {
  const sorted = [...all].sort((left, right) => left.matingDate.localeCompare(right.matingDate) || left.id - right.id);
  return cohort.map((mating) => {
    const next = sorted.find((record) => record.animalNo === mating.animalNo && (record.matingDate > mating.matingDate || (record.matingDate === mating.matingDate && record.id > mating.id)));
    const limit = (date: string) => date > mating.matingDate && date <= endDate && (!next || date <= next.matingDate);
    const incident = incidents.filter((record) => record.animalNo === mating.animalNo && limit(record.incidentDate)).sort((left, right) => left.incidentDate.localeCompare(right.incidentDate))[0];
    const farrowing = farrowings.filter((record) => record.animalNo === mating.animalNo && limit(record.farrowingDate)).sort((left, right) => left.farrowingDate.localeCompare(right.farrowingDate))[0];
    const cull = culls.filter((record) => record.animalNo === mating.animalNo && limit(record.eventDate)).sort((left, right) => left.eventDate.localeCompare(right.eventDate))[0];
    const result: Outcome = { mating, pending: false, overdue: false };
    if (incident && (!farrowing || incident.incidentDate <= farrowing.farrowingDate)) {
      const days = daysBetween(mating.matingDate, incident.incidentDate);
      result.incident = { date: incident.incidentDate, cause: incident.cause, days, week: Math.min(INCIDENT_WEEKS, Math.max(1, Math.floor((days - 1) / 7) + 1)), column: incidentColumn(incident.cause) };
    } else if (farrowing) {
      result.farrowing = farrowing;
      const weaning = weanings.filter((record) => record.animalNo === mating.animalNo && record.weaningDate >= farrowing.farrowingDate && record.weaningDate <= endDate && (!record.farrowingDate || record.farrowingDate === farrowing.farrowingDate)).sort((left, right) => left.weaningDate.localeCompare(right.weaningDate))[0];
      if (weaning) {
        result.weaning = weaning;
        const remate = sorted.find((record) => record.animalNo === mating.animalNo && record.matingDate >= weaning.weaningDate && record.matingDate <= endDate);
        if (remate) result.nextMatingDays = daysBetween(weaning.weaningDate, remate.matingDate);
      }
    } else if (cull && (cull.type === "도태" || cull.type === "폐사")) {
      // 임신 중 도태·폐사(사고 기록 없음)는 해당 임신사고 칸으로 센다.
      const days = daysBetween(mating.matingDate, cull.eventDate);
      result.incident = { date: cull.eventDate, cause: cull.type, days, week: Math.min(INCIDENT_WEEKS, Math.max(1, Math.floor((days - 1) / 7) + 1)), column: cull.type };
    } else if (cull) result.removed = { date: cull.eventDate, type: cull.type };
    else { result.pending = true; result.overdue = addDays(mating.matingDate, EXPECTED_FARROWING_OFFSET) < endDate; }
    return result;
  });
}

function groupLabel(period: MatingPeriod, unit: string, unitCount: number) {
  if (unit !== "week") return period.label;
  const from = weekNumber(period.start); const to = weekNumber(period.end);
  return `${String(from.year).slice(2)}-${from.week} to ${unitCount === 1 ? from.week : to.week}`;
}

export function buildMatingGroups(periods: MatingPeriod[], unit: string, unitCount: number, matings: MatingRecord[], incidents: PregnancyIncidentRecord[], culls: CullRecord[], farrowings: FarrowingRecord[], weanings: WeaningRecord[]) {
  const endDate = periods.at(-1)?.end ?? "";
  const perPeriod = periods.map((period) => outcomes(matings.filter((record) => record.matingDate >= period.start && record.matingDate <= period.end), matings, incidents, culls, farrowings, weanings, endDate));

  const summarize = (period: { label: string; group: string; start: string; end: string }, list: Outcome[]): GroupRow => {
    const farrowed = list.filter((item) => item.farrowing); const weaned = list.filter((item) => item.weaning);
    const dates = farrowed.map((item) => item.farrowing!.farrowingDate).sort();
    const totalBorn = farrowed.reduce((sum, item) => sum + num(item.farrowing!.totalBorn), 0);
    const liveBorn = farrowed.reduce((sum, item) => sum + num(item.farrowing!.liveFemale) + num(item.farrowing!.liveMale), 0);
    const weanedCount = weaned.reduce((sum, item) => sum + num(item.weaning!.femaleCount) + num(item.weaning!.maleCount), 0);
    const incidentsByColumn = { 재발: 0, 유산: 0, 도태: 0, 폐사: 0 };
    list.forEach((item) => { if (item.incident) incidentsByColumn[item.incident.column] += 1; });
    const remated = list.filter((item) => item.nextMatingDays !== undefined);
    return {
      ...period, matings: list.length, incidents: incidentsByColumn, removed: list.filter((item) => item.removed).length,
      incidentDays: avg(list.filter((item) => item.incident).map((item) => item.incident!.days), 0),
      farrowingRange: dates.length ? `${dates[0].slice(5)}~${dates.at(-1)!.slice(5)}` : "",
      farrowings: farrowed.length, parity: avg(farrowed.map((item) => num(item.farrowing!.parity)), 1), farrowingRate: rate(farrowed.length, list.length),
      gestation: avg(farrowed.map((item) => daysBetween(item.mating.matingDate, item.farrowing!.farrowingDate)), 1),
      totalBorn, avgTotalBorn: farrowed.length ? Math.round((totalBorn / farrowed.length) * 10) / 10 : null,
      mummified: farrowed.reduce((sum, item) => sum + num(item.farrowing!.mummified), 0), stillborn: farrowed.reduce((sum, item) => sum + num(item.farrowing!.stillborn), 0),
      liveBorn, avgLiveBorn: farrowed.length ? Math.round((liveBorn / farrowed.length) * 10) / 10 : null,
      weanedSows: weaned.length, fosterWeaned: weaned.filter((item) => item.weaning!.reNursing === "예").length, weaned: weanedCount,
      weanedPerLitter: weaned.length ? Math.round((weanedCount / weaned.length) * 10) / 10 : null,
      weaningAge: avg(weaned.map((item) => item.weaning!.weaningAge ? num(item.weaning!.weaningAge) : daysBetween(item.farrowing!.farrowingDate, item.weaning!.weaningDate)), 1),
      rematedSows: remated.length, returnDays: avg(remated.map((item) => item.nextMatingDays!), 1),
    };
  };

  const groupRows = periods.map((period, index) => summarize({ label: period.start.slice(0, 4) + "-" + (period.start.slice(5) === period.end.slice(5) ? period.start.slice(5) : `${period.start.slice(5)}~${period.end.slice(5)}`), group: groupLabel(period, unit, unitCount), start: period.start, end: period.end }, perPeriod[index]));
  const groupTotal = summarize({ label: "합계/평균", group: "", start: periods[0]?.start ?? "", end: endDate }, perPeriod.flat());

  const weeklyRows: WeeklyRow[] = periods.map((period, index) => {
    const list = perPeriod[index];
    const byWeek = Array.from({ length: INCIDENT_WEEKS }, (_, week) => list.filter((item) => item.incident && item.incident.week === week + 1).length);
    const farrowed = list.filter((item) => item.farrowing).length;
    return { label: unit === "week" && unitCount === 1 ? String(weekNumber(period.start).week) : groupLabel(period, unit, unitCount), start: period.start, end: period.end, matings: list.length, byWeek, pending: list.filter((item) => item.pending && !item.overdue).length, farrowings: farrowed, farrowingRate: rate(farrowed, list.length), overdue: list.filter((item) => item.overdue).length, removed: list.filter((item) => item.removed).length };
  });
  const all = perPeriod.flat();
  const weeklyTotal: WeeklyRow = { label: "합계", start: periods[0]?.start ?? "", end: endDate, matings: all.length, byWeek: weeklyRows.reduce((sum, row) => sum.map((value, index) => value + row.byWeek[index]), Array(INCIDENT_WEEKS).fill(0)), pending: weeklyRows.reduce((sum, row) => sum + row.pending, 0), farrowings: weeklyRows.reduce((sum, row) => sum + row.farrowings, 0), farrowingRate: rate(weeklyRows.reduce((sum, row) => sum + row.farrowings, 0), all.length), overdue: weeklyRows.reduce((sum, row) => sum + row.overdue, 0), removed: weeklyRows.reduce((sum, row) => sum + row.removed, 0) };
  return { groupRows, groupTotal, weeklyRows, weeklyTotal };
}
