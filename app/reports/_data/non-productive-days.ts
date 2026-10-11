import type { SowCullRecord as CullRecord } from "../../production/sows/_data/cull-records";
import type { FarrowingRecord } from "../../production/sows/_data/farrowing-records";
import type { SowIntakeRecord } from "../../production/sows/_data/intake-records";
import type { MatingRecord } from "../../production/sows/_data/mating-records";
import type { PregnancyIncidentRecord } from "../../production/sows/_data/pregnancy-incident-records";
import type { WeaningRecord } from "../../production/sows/_data/weaning-records";
import type { MatingPeriod } from "./mating-results";
import { collectIncidentEvents, DAY_ROWS, dayCategory } from "./pregnancy-incident-analysis";

// 비생산일수 분석(피그지오 "비생산일수 분석" 표, 계산식은 피그플랜 매뉴얼 생산성적 정의 p.232).
// 일수는 피그플랜 방식대로 "시작일 0, 끝일 1"로 세고(구간 (시작, 끝]), 기간에 걸친 만큼 날짜별로 나눠 넣는다.
// 아직 끝나지 않은 상태(미교배 후보돈, 이유 후 미교배, 사고 후 미처리, 포유 중)는 조회 종료일(오늘 이후면 오늘)까지 센다.

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

type Interval = { animalNo: string; start: string; end: string }; // (start, end]
export type NpdSegment = Interval & { key: NpdSegmentKey; incidentRow?: string };
export type NpdRow = { key: string; group: string; label: string; values: Array<number | null>; total: number | null; average: number | null; ratio: number | null; digits: number };

function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); }
function addDays(text: string, days: number) { const date = new Date(`${text}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
const round = (value: number, digits: number) => { const factor = 10 ** digits; return Math.round(value * factor) / factor; };
const minDate = (...dates: Array<string | undefined>) => dates.filter((date): date is string => !!date).sort()[0];

// (start, end] 구간 중 기간 [periodStart, periodEnd]에 든 날 수.
function overlap(interval: { start: string; end: string }, period: { start: string; end: string }) {
  const from = interval.start > addDays(period.start, -1) ? interval.start : addDays(period.start, -1);
  const to = interval.end < period.end ? interval.end : period.end;
  return to > from ? daysBetween(from, to) : 0;
}

type Animal = { animalNo: string; breed: string; gilt: boolean; herdStart?: string; firstMating?: string; exit?: string };

function buildAnimals(intakes: SowIntakeRecord[], matings: MatingRecord[], farrowings: FarrowingRecord[], weanings: WeaningRecord[], culls: CullRecord[]) {
  const animals = new Map<string, Animal>();
  const get = (animalNo: string) => { let animal = animals.get(animalNo); if (!animal) { animal = { animalNo, breed: "", gilt: false }; animals.set(animalNo, animal); } return animal; };
  intakes.forEach((record) => { if (!record.animalNo || !record.intakeDate) return; const animal = get(record.animalNo); if (!animal.herdStart || record.intakeDate < animal.herdStart) { animal.herdStart = record.intakeDate; animal.gilt = record.status === "후보돈"; } animal.breed ||= record.breed; });
  matings.forEach((record) => { const animal = get(record.animalNo); animal.firstMating = minDate(animal.firstMating, record.matingDate); animal.herdStart = minDate(animal.herdStart, record.matingDate); animal.breed ||= record.breed; });
  [...farrowings.map((record) => ({ animalNo: record.animalNo, date: record.farrowingDate, breed: record.breed })), ...weanings.map((record) => ({ animalNo: record.animalNo, date: record.weaningDate, breed: "" }))].forEach((record) => { if (!record.date) return; const animal = get(record.animalNo); animal.herdStart = minDate(animal.herdStart, record.date); animal.breed ||= record.breed; });
  culls.forEach((record) => { const animal = animals.get(record.animalNo); if (!animal) return; animal.exit = minDate(animal.exit, record.eventDate); animal.breed ||= record.breed; });
  return animals;
}

// asOf: 진행 중인 상태를 끊는 날(조회 종료일과 오늘 중 이른 날).
export function collectNpdIntervals(asOf: string, intakes: SowIntakeRecord[], matings: MatingRecord[], incidents: PregnancyIncidentRecord[], culls: CullRecord[], farrowings: FarrowingRecord[], weanings: WeaningRecord[]) {
  const animals = buildAnimals(intakes, matings, farrowings, weanings, culls);
  const events = collectIncidentEvents(matings, incidents, culls, farrowings);
  const matingsBy = new Map<string, string[]>(); matings.forEach((record) => { const list = matingsBy.get(record.animalNo) ?? []; list.push(record.matingDate); matingsBy.set(record.animalNo, list); });
  matingsBy.forEach((list) => list.sort());
  const nextMating = (animalNo: string, date: string) => (matingsBy.get(animalNo) ?? []).find((value) => value >= date);
  const segments: NpdSegment[] = [];
  const push = (animalNo: string, key: NpdSegmentKey, start: string, end: string, incidentRow?: string) => { if (end > start) segments.push({ animalNo, key, start, end, incidentRow }); };
  // 다음 교배 → (교배 구간), 없으면 도폐사 → (도폐 구간), 둘 다 없으면 기준일까지 진행 중(교배 대기로 본다).
  const until = (animalNo: string, from: string, toMating: NpdSegmentKey, toCull: NpdSegmentKey) => {
    const exit = animals.get(animalNo)?.exit; const next = nextMating(animalNo, from);
    if (next && (!exit || next <= exit)) push(animalNo, toMating, from, next);
    else if (exit && exit >= from) push(animalNo, toCull, from, exit);
    else push(animalNo, toMating, from, asOf);
  };

  const herd: Interval[] = []; const gilts: Interval[] = []; const lactation: Interval[] = [];
  animals.forEach((animal) => {
    if (!animal.herdStart) return;
    herd.push({ animalNo: animal.animalNo, start: animal.herdStart, end: minDate(animal.exit, asOf)! });
    if (animal.gilt) {
      const end = minDate(animal.firstMating, animal.exit, asOf)!;
      gilts.push({ animalNo: animal.animalNo, start: animal.herdStart, end });
      if (animal.firstMating && end === animal.firstMating) push(animal.animalNo, "giltToMating", animal.herdStart, end);
      else if (animal.exit && end === animal.exit) push(animal.animalNo, "giltToCull", animal.herdStart, end);
      else push(animal.animalNo, "giltToMating", animal.herdStart, end); // 아직 초교배 전인 후보돈
    }
  });
  farrowings.forEach((record) => {
    if (!record.farrowingDate) return; const exit = animals.get(record.animalNo)?.exit;
    const weaning = weanings.filter((item) => item.animalNo === record.animalNo && item.weaningDate >= record.farrowingDate && (!item.farrowingDate || item.farrowingDate === record.farrowingDate)).map((item) => item.weaningDate).sort()[0];
    lactation.push({ animalNo: record.animalNo, start: record.farrowingDate, end: minDate(weaning, exit, asOf)! });
  });
  weanings.forEach((record) => { if (record.weaningDate && record.weaningDate <= asOf) until(record.animalNo, record.weaningDate, "weanToMating", "weanToCull"); });
  events.forEach((event) => {
    if (event.date > asOf) return;
    const row = event.cause === "유산" || event.cause === "도태" || event.cause === "폐사" ? event.cause : dayCategory(event.days);
    push(event.animalNo, "matingToIncident", event.matingDate, event.date, row);
    if (event.source !== "cull") until(event.animalNo, event.date, "incidentToMating", "incidentToCull"); // 사고 자체가 도태·폐사면 이후 구간 없음
  });
  return { animals, segments, herd, gilts, lactation };
}

export function buildNonProductiveDays(periods: MatingPeriod[], breed: string, today: string, data: { intakes: SowIntakeRecord[]; matings: MatingRecord[]; incidents: PregnancyIncidentRecord[]; culls: CullRecord[]; farrowings: FarrowingRecord[]; weanings: WeaningRecord[] }) {
  const whole = { start: periods[0]?.start ?? "", end: periods.at(-1)?.end ?? "" };
  const asOf = whole.end < today ? whole.end : today;
  const { animals, segments, herd, gilts, lactation } = collectNpdIntervals(asOf, data.intakes, data.matings, data.incidents, data.culls, data.farrowings, data.weanings);
  const included = (animalNo: string) => !breed || animals.get(animalNo)?.breed === breed;
  const spans = [...periods, whole]; const n = periods.length;
  const periodDays = spans.map((span) => daysBetween(span.start, span.end) + 1);
  const days = (list: Interval[], span: { start: string; end: string }, test: (item: Interval) => boolean = () => true) => list.reduce((sum, item) => sum + (included(item.animalNo) && test(item) ? overlap(item, span) : 0), 0);

  const herdDays = spans.map((span) => days(herd, span)); // 총모돈사육일수(후보포함)
  const giltDays = spans.map((span) => days(gilts, span)); // 후보돈사육일수
  const sowDays = spans.map((_, index) => herdDays[index] - giltDays[index]);
  const lactationDays = spans.map((span) => days(lactation, span)); // 포유일수
  const segmentDays = (test: (segment: NpdSegment) => boolean) => spans.map((span) => days(segments, span, (item) => test(item as NpdSegment)));

  const dayRows = DAY_ROWS.map((row) => segmentDays((segment) => segment.key === "matingToIncident" && segment.incidentRow === row));
  const subtotal = spans.map((_, index) => dayRows.reduce((total, values) => total + values[index], 0));
  const otherRows = (["유산", "도태", "폐사"] as const).map((row) => segmentDays((segment) => segment.key === "matingToIncident" && segment.incidentRow === row));
  const incidentTotal = spans.map((_, index) => subtotal[index] + otherRows.reduce((total, values) => total + values[index], 0));
  const segmentValues = SEGMENT_ROWS.map((row) => segmentDays((segment) => segment.key === row.key));
  const allNpd = spans.map((_, index) => segmentValues.reduce((total, values) => total + values[index], 0)); // 후보돈포함 총비생산일수
  const sowNpd = spans.map((_, index) => SEGMENT_ROWS.reduce((total, row, rowIndex) => total + (row.gilt ? 0 : segmentValues[rowIndex][index]), 0)); // 총비생산일수(후보제외)
  const pregnancyDays = spans.map((_, index) => Math.max(0, sowDays[index] - lactationDays[index] - sowNpd[index])); // 임신일수

  // 평균임신기간: 기간 안 분만모돈의 (분만일 − 교배일) 평균. 분만이 없으면 회전율은 빈칸(피그지오와 같음).
  const matingDates = new Map<string, string[]>(); data.matings.forEach((record) => { const list = matingDates.get(record.animalNo) ?? []; list.push(record.matingDate); matingDates.set(record.animalNo, list); });
  const gestations = data.farrowings.filter((record) => included(record.animalNo) && record.farrowingDate).map((record) => { const mating = record.matingDate || (matingDates.get(record.animalNo) ?? []).filter((date) => date < record.farrowingDate).sort().at(-1); return mating ? { date: record.farrowingDate, days: daysBetween(mating, record.farrowingDate) } : null; }).filter((item): item is { date: string; days: number } => !!item && item.days >= 100 && item.days <= 130);
  const avgGestation = spans.map((span) => { const list = gestations.filter((item) => item.date >= span.start && item.date <= span.end); return list.length ? list.reduce((total, item) => total + item.days, 0) / list.length : null; });

  const annual = (npd: number[], base: number[]) => spans.map((_, index) => base[index] ? (npd[index] * 365) / base[index] : null);
  const avgNpd = annual(sowNpd, sowDays); // 총비생산일수(후보제외) × 365 / (모돈사육일수 − 후보돈사육일수)
  const avgNpdWithGilts = annual(allNpd, herdDays); // (총비생산일수 + 후보돈사육일수) × 365 / 총모돈사육일수
  const turnover = (base: number[]) => spans.map((_, index) => base[index] && avgGestation[index] ? (pregnancyDays[index] / base[index]) * 365 / avgGestation[index]! : null);

  const blank = (value: number) => (value ? value : null);
  const countRow = (key: string, group: string, label: string, values: number[], base: number): NpdRow => { const total = values.slice(0, n).reduce((a, b) => a + b, 0); return { key, group, label, values: values.slice(0, n).map(blank), total: blank(total), average: total ? round(total / n, 1) : null, ratio: base && total ? round((total / base) * 100, 1) : null, digits: 0 }; };
  const derivedRow = (key: string, label: string, values: Array<number | null>, digits: number, average: number | null): NpdRow => ({ key, group: label, label, values: values.slice(0, n).map((value) => value === null ? null : round(value, digits)), total: values.slice(0, n).some((value) => value !== null) ? round(values.slice(0, n).reduce<number>((a, b) => a + (b ?? 0), 0), digits) : null, average: average === null ? null : round(average, digits), ratio: null, digits });
  const sows = sowDays.map((value, index) => value ? value / periodDays[index] : null);
  const sowsWithGilts = herdDays.map((value, index) => value ? value / periodDays[index] : null);
  const meanOf = (values: Array<number | null>) => values.slice(0, n).some((value) => value !== null) ? values.slice(0, n).reduce<number>((a, b) => a + (b ?? 0), 0) / n : null;
  const totalIncident = incidentTotal[n]; const totalNpd = allNpd[n];

  const rows: NpdRow[] = [
    derivedRow("sows", "상시모돈수", sows, 1, meanOf(sows)),
    derivedRow("sowsWithGilts", "후보돈포함 상시모돈수", sowsWithGilts, 1, meanOf(sowsWithGilts)),
    ...DAY_ROWS.map((row, index) => countRow(`incident-${row}`, "임신사고일수", row, dayRows[index], totalIncident)),
    countRow("incident-subtotal", "임신사고일수", "소계", subtotal, totalIncident),
    ...(["유산", "도태", "폐사"] as const).map((row, index) => countRow(`incident-${row}`, "임신사고일수", row, otherRows[index], totalIncident)),
    countRow("incident-total", "임신사고일수", "합계", incidentTotal, totalIncident),
    ...SEGMENT_ROWS.map((row, index) => countRow(row.key, row.label, row.label, segmentValues[index], totalNpd)),
    countRow("npd-total", "후보돈포함 총비생산일수", "후보돈포함 총비생산일수", allNpd, totalNpd),
    derivedRow("avgNpd", "평균 비생산일수", avgNpd, 1, avgNpd[n]),
    derivedRow("avgNpdWithGilts", "후보돈포함 평균비생산일수", avgNpdWithGilts, 1, avgNpdWithGilts[n]),
    derivedRow("turnover", "모돈회전율", turnover(sowDays), 2, turnover(sowDays)[n]),
    derivedRow("turnoverWithGilts", "후보돈포함 모돈회전율", turnover(herdDays), 2, turnover(herdDays)[n]),
  ];
  return { rows, asOf, avgGestation: avgGestation[n] === null ? null : round(avgGestation[n]!, 1), totals: { herdDays: herdDays[n], giltDays: giltDays[n], lactationDays: lactationDays[n], sowNpd: sowNpd[n], pregnancyDays: pregnancyDays[n] } };
}
