import type { SowCullRecord as CullRecord } from "../../production/sows/_data/cull-records";
import type { FarrowingRecord } from "../../production/sows/_data/farrowing-records";
import type { SowIntakeRecord } from "../../production/sows/_data/intake-records";
import type { MatingRecord } from "../../production/sows/_data/mating-records";
import type { PregnancyIncidentRecord } from "../../production/sows/_data/pregnancy-incident-records";
import type { WeaningRecord } from "../../production/sows/_data/weaning-records";
import type { MatingPeriod } from "./mating-results";
import { collectIncidentEvents, DAY_ROWS, dayCategory } from "./pregnancy-incident-analysis";

// 비생산일수 분석(피그플랜 "비생산일수(기간별)" 양식).
// 각 비생산 구간은 끝나는 날(교배·사고·도폐사일)이 속한 기간에 넣는다(임신사고원인분석과 같은 기준).
const DEFAULT_GESTATION = 114;
const DEFAULT_LACTATION = 28;

export type NpdSegmentKey = "giltToMating" | "giltToCull" | "weanToMating" | "weanToCull" | "matingToIncident" | "incidentToMating" | "incidentToCull";
export const SEGMENT_ROWS: Array<{ key: NpdSegmentKey; label: string; gilt?: boolean }> = [
  { key: "giltToMating", label: "후보돈전입 ~ 초교배", gilt: true },
  { key: "giltToCull", label: "후보돈전입 ~ 도폐사", gilt: true },
  { key: "weanToMating", label: "이유후 ~ 교배" },
  { key: "weanToCull", label: "이유후 ~ 도폐" },
  { key: "matingToIncident", label: "교배후 ~ 사고" },
  { key: "incidentToMating", label: "사고후 ~ 교배" },
  { key: "incidentToCull", label: "사고후 ~ 도폐" },
];
export const INCIDENT_DAY_ROWS = [...DAY_ROWS, "소계", "유산", "도태", "폐사", "합계"] as const;

export type NpdSegment = { animalNo: string; key: NpdSegmentKey; start: string; end: string; days: number; incidentRow?: string };
export type NpdRow = { key: string; group: string; label: string; values: Array<number | null>; total: number | null; average: number | null; ratio: number | null; digits: number };

function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); }
function addDays(text: string, days: number) { const date = new Date(`${text}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
const round = (value: number, digits: number) => { const factor = 10 ** digits; return Math.round(value * factor) / factor; };
const minDate = (...dates: Array<string | undefined>) => dates.filter((date): date is string => !!date).sort()[0];

type Animal = { animalNo: string; breed: string; gilt: boolean; herdStart?: string; sowStart?: string; exit?: string };

function buildAnimals(intakes: SowIntakeRecord[], matings: MatingRecord[], farrowings: FarrowingRecord[], weanings: WeaningRecord[], culls: CullRecord[]) {
  const animals = new Map<string, Animal>();
  const get = (animalNo: string) => { let animal = animals.get(animalNo); if (!animal) { animal = { animalNo, breed: "", gilt: false }; animals.set(animalNo, animal); } return animal; };
  intakes.forEach((record) => { if (!record.animalNo || !record.intakeDate) return; const animal = get(record.animalNo); if (!animal.herdStart || record.intakeDate < animal.herdStart) { animal.herdStart = record.intakeDate; animal.gilt = record.status === "후보돈"; if (!animal.gilt) animal.sowStart = record.intakeDate; } animal.breed ||= record.breed; });
  matings.forEach((record) => { const animal = get(record.animalNo); animal.sowStart = minDate(animal.sowStart, record.matingDate); animal.herdStart = minDate(animal.herdStart, record.matingDate); animal.breed ||= record.breed; });
  [...farrowings.map((record) => ({ animalNo: record.animalNo, date: record.farrowingDate, breed: record.breed })), ...weanings.map((record) => ({ animalNo: record.animalNo, date: record.weaningDate, breed: "" }))].forEach((record) => { if (!record.date) return; const animal = get(record.animalNo); animal.sowStart = minDate(animal.sowStart, record.date); animal.herdStart = minDate(animal.herdStart, record.date); animal.breed ||= record.breed; });
  culls.forEach((record) => { const animal = animals.get(record.animalNo); if (!animal) return; animal.exit = minDate(animal.exit, record.eventDate); animal.breed ||= record.breed; });
  return animals;
}

// 기간 안에 머문 날 수(시작일 포함, 도폐사일 제외).
function overlap(from: string | undefined, exit: string | undefined, period: { start: string; end: string }) {
  if (!from) return 0; const lastDay = exit ? addDays(exit, -1) : period.end;
  const start = from > period.start ? from : period.start; const end = lastDay < period.end ? lastDay : period.end;
  return end >= start ? daysBetween(start, end) + 1 : 0;
}

export function collectSegments(intakes: SowIntakeRecord[], matings: MatingRecord[], incidents: PregnancyIncidentRecord[], culls: CullRecord[], farrowings: FarrowingRecord[], weanings: WeaningRecord[]) {
  const animals = buildAnimals(intakes, matings, farrowings, weanings, culls);
  const events = collectIncidentEvents(matings, incidents, culls, farrowings);
  const matingsBy = new Map<string, string[]>(); matings.forEach((record) => { const list = matingsBy.get(record.animalNo) ?? []; list.push(record.matingDate); matingsBy.set(record.animalNo, list); });
  matingsBy.forEach((list) => list.sort());
  const nextMating = (animalNo: string, date: string, inclusive: boolean) => (matingsBy.get(animalNo) ?? []).find((value) => inclusive ? value >= date : value > date);
  const segments: NpdSegment[] = [];
  const push = (animalNo: string, key: NpdSegmentKey, start: string, end: string, incidentRow?: string) => { if (end < start) return; segments.push({ animalNo, key, start, end, days: daysBetween(start, end), incidentRow }); };

  animals.forEach((animal) => {
    if (!animal.gilt || !animal.herdStart) return;
    const first = nextMating(animal.animalNo, animal.herdStart, true);
    if (first && (!animal.exit || first <= animal.exit)) push(animal.animalNo, "giltToMating", animal.herdStart, first);
    else if (animal.exit) push(animal.animalNo, "giltToCull", animal.herdStart, animal.exit);
  });
  weanings.forEach((record) => {
    if (!record.weaningDate) return; const exit = animals.get(record.animalNo)?.exit;
    const next = nextMating(record.animalNo, record.weaningDate, true);
    if (next && (!exit || next <= exit)) push(record.animalNo, "weanToMating", record.weaningDate, next);
    else if (exit && exit >= record.weaningDate) push(record.animalNo, "weanToCull", record.weaningDate, exit);
  });
  events.forEach((event) => {
    const row = event.cause === "유산" || event.cause === "도태" || event.cause === "폐사" ? event.cause : dayCategory(event.days, event.cause);
    push(event.animalNo, "matingToIncident", event.matingDate, event.date, row);
    if (event.source === "cull") return; // 사고 자체가 도태·폐사
    const exit = animals.get(event.animalNo)?.exit;
    const next = nextMating(event.animalNo, event.date, true);
    if (next && (!exit || next <= exit)) push(event.animalNo, "incidentToMating", event.date, next);
    else if (exit && exit >= event.date) push(event.animalNo, "incidentToCull", event.date, exit);
  });
  return { animals, segments };
}

export function breedOptions(intakes: SowIntakeRecord[], matings: MatingRecord[]) {
  return [...new Set([...intakes.map((record) => record.breed), ...matings.map((record) => record.breed)].map((breed) => breed?.trim()).filter(Boolean))].sort();
}

export function buildNonProductiveDays(periods: MatingPeriod[], breed: string, data: { intakes: SowIntakeRecord[]; matings: MatingRecord[]; incidents: PregnancyIncidentRecord[]; culls: CullRecord[]; farrowings: FarrowingRecord[]; weanings: WeaningRecord[] }) {
  const { animals, segments } = collectSegments(data.intakes, data.matings, data.incidents, data.culls, data.farrowings, data.weanings);
  const included = (animalNo: string) => !breed || animals.get(animalNo)?.breed === breed;
  const whole = { start: periods[0]?.start ?? "", end: periods.at(-1)?.end ?? "" };
  const spans = [...periods, whole];
  const herd = [...animals.values()].filter((animal) => included(animal.animalNo));
  const periodDays = spans.map((span) => daysBetween(span.start, span.end) + 1);
  const sows = spans.map((span, index) => herd.reduce((sum, animal) => sum + overlap(animal.sowStart, animal.exit, span), 0) / periodDays[index]);
  const herdWithGilts = spans.map((span, index) => herd.reduce((sum, animal) => sum + overlap(animal.herdStart, animal.exit, span), 0) / periodDays[index]);
  const inSpan = (span: { start: string; end: string }) => segments.filter((segment) => included(segment.animalNo) && segment.end >= span.start && segment.end <= span.end);
  const segmentsBySpan = spans.map(inSpan);
  const sum = (list: NpdSegment[], test: (segment: NpdSegment) => boolean) => list.filter(test).reduce((total, segment) => total + segment.days, 0);

  // 회전율 분모: 기간 안 평균 임신기간 + 평균 포유기간(기록이 없으면 전체 평균, 그것도 없으면 114일 + 28일).
  const matingDates = new Map<string, string[]>(); data.matings.forEach((record) => { const list = matingDates.get(record.animalNo) ?? []; list.push(record.matingDate); matingDates.set(record.animalNo, list); });
  const gestations = data.farrowings.filter((record) => included(record.animalNo) && record.farrowingDate).map((record) => { const mating = record.matingDate || (matingDates.get(record.animalNo) ?? []).filter((date) => date < record.farrowingDate).sort().at(-1); return mating ? { date: record.farrowingDate, days: daysBetween(mating, record.farrowingDate) } : null; }).filter((item): item is { date: string; days: number } => !!item && item.days >= 100 && item.days <= 130);
  const lactations = data.weanings.filter((record) => included(record.animalNo) && record.weaningDate && record.farrowingDate).map((record) => ({ date: record.weaningDate, days: daysBetween(record.farrowingDate, record.weaningDate) })).filter((item) => item.days > 0 && item.days <= 60);
  const mean = (list: Array<{ days: number }>) => list.length ? list.reduce((total, item) => total + item.days, 0) / list.length : null;
  const overallCycle = (mean(gestations) ?? DEFAULT_GESTATION) + (mean(lactations) ?? DEFAULT_LACTATION);
  const cycle = spans.map((span) => { const g = mean(gestations.filter((item) => item.date >= span.start && item.date <= span.end)); const l = mean(lactations.filter((item) => item.date >= span.start && item.date <= span.end)); return g === null && l === null ? overallCycle : (g ?? mean(gestations) ?? DEFAULT_GESTATION) + (l ?? mean(lactations) ?? DEFAULT_LACTATION); });

  const n = periods.length;
  const blank = (value: number) => (value ? value : null);
  const countRow = (key: string, group: string, label: string, values: number[], base: number | null): NpdRow => { const total = values.slice(0, n).reduce((a, b) => a + b, 0); return { key, group, label, values: values.slice(0, n).map(blank), total: blank(total), average: total ? round(total / n, 1) : null, ratio: base && total ? round((total / base) * 100, 1) : null, digits: 0 }; };
  const derivedRow = (key: string, label: string, values: Array<number | null>, digits: number): NpdRow => ({ key, group: label, label, values: values.slice(0, n).map((value) => value === null ? null : round(value, digits)), total: round(values.slice(0, n).reduce<number>((a, b) => a + (b ?? 0), 0), digits), average: values[n] === null ? null : round(values[n]!, digits), ratio: null, digits });

  const incidentDays = (row: string) => segmentsBySpan.map((list) => sum(list, (segment) => segment.key === "matingToIncident" && segment.incidentRow === row));
  const dayRows = DAY_ROWS.map((row) => incidentDays(row));
  const subtotal = spans.map((_, index) => dayRows.reduce((total, values) => total + values[index], 0));
  const otherRows = (["유산", "도태", "폐사"] as const).map((row) => incidentDays(row));
  const incidentTotal = spans.map((_, index) => subtotal[index] + otherRows.reduce((total, values) => total + values[index], 0));
  const segmentValues = SEGMENT_ROWS.map((row) => segmentsBySpan.map((list) => sum(list, (segment) => segment.key === row.key)));
  const allNpd = spans.map((_, index) => segmentValues.reduce((total, values) => total + values[index], 0));
  const sowNpd = spans.map((_, index) => SEGMENT_ROWS.reduce((total, row, rowIndex) => total + (row.gilt ? 0 : segmentValues[rowIndex][index]), 0));
  const totalIncident = incidentTotal.slice(0, n).reduce((a, b) => a + b, 0); const totalNpd = allNpd.slice(0, n).reduce((a, b) => a + b, 0);
  const annual = (npd: number[], herdSize: number[]) => spans.map((_, index) => herdSize[index] ? (npd[index] / herdSize[index]) * (365 / periodDays[index]) : null);
  const avgNpd = annual(sowNpd, sows); const avgNpdWithGilts = annual(allNpd, herdWithGilts);
  const turnover = (values: Array<number | null>) => values.map((value, index) => value === null ? null : Math.max(0, (365 - value) / cycle[index])); // 비생산일수가 365일을 넘으면 0

  const rows: NpdRow[] = [
    { ...derivedRow("sows", "상시모돈수", sows.map((value) => value || null), 1), average: n ? round(sows.slice(0, n).reduce((a, b) => a + b, 0) / n, 1) : null },
    { ...derivedRow("sowsWithGilts", "후보돈포함 상시모돈수", herdWithGilts.map((value) => value || null), 1), average: n ? round(herdWithGilts.slice(0, n).reduce((a, b) => a + b, 0) / n, 1) : null },
    ...DAY_ROWS.map((row, index) => countRow(`incident-${row}`, "임신사고일수", row, dayRows[index], totalIncident)),
    countRow("incident-subtotal", "임신사고일수", "소계", subtotal, totalIncident),
    ...(["유산", "도태", "폐사"] as const).map((row, index) => countRow(`incident-${row}`, "임신사고일수", row, otherRows[index], totalIncident)),
    countRow("incident-total", "임신사고일수", "합계", incidentTotal, totalIncident),
    ...SEGMENT_ROWS.map((row, index) => { const built = countRow(row.key, row.label, row.label, segmentValues[index], totalNpd); return built; }),
    countRow("npd-total", "후보돈포함 총비생산일수", "후보돈포함 총비생산일수", allNpd, totalNpd),
    derivedRow("avgNpd", "평균 비생산일수", avgNpd, 1),
    derivedRow("avgNpdWithGilts", "후보돈포함 평균비생산일수", avgNpdWithGilts, 1),
    derivedRow("turnover", "모돈회전율", turnover(avgNpd), 2),
    derivedRow("turnoverWithGilts", "후보돈포함 모돈회전율", turnover(avgNpdWithGilts), 2),
  ];
  return { rows, cycle: round(cycle[n], 1) };
}
