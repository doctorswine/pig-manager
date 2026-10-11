import type { SowCullRecord as CullRecord } from "../../production/sows/_data/cull-records";
import type { FarrowingRecord } from "../../production/sows/_data/farrowing-records";
import type { MatingRecord } from "../../production/sows/_data/mating-records";
import type { PregnancyIncidentRecord } from "../../production/sows/_data/pregnancy-incident-records";
import type { MatingPeriod } from "./mating-results";

// 임신사고원인분석(피그플랜 양식): 산출 기간 안에 발생한 임신사고를 구간별·원인별로 센다.
const EXPECTED_FARROWING_OFFSET = 114; // 교배일 1일차 기준 115일째 = 분만예정일
const PREGNANT_CULL_LIMIT = EXPECTED_FARROWING_OFFSET + 7; // 교배 후 이 기간 안의 도태·폐사는 임신 중 사고로 본다

export type IncidentEvent = { animalNo: string; matingDate: string; date: string; cause: string; days: number; parity: number; streak: number; source: "incident" | "cull" };
export type IncidentRowKind = "count" | "days" | "average";
export type IncidentRow = { key: string; group: string; label: string; kind: IncidentRowKind; values: Array<number | null>; total: number | null; average: number | null };

export const CAUSE_ROWS = ["재발불임(구)", "유산", "공태", "도태", "폐사", "재발", "불임"] as const;
export const DAY_ROWS = ["조기재발", "1차재발", "불규칙재발", "2차재발", "지연재발", "공태", "분만사불임"] as const;
export const PARITY_ROWS = ["0산", "1산", "2산", "3산", "4산", "5산", "6산", "7산", "8산+"] as const;
export const STREAK_ROWS = ["1회사고", "2회연속", "3회연속", "4회연속+"] as const;

function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
const round1 = (value: number) => Math.round(value * 10) / 10;

// 교배 후 사고까지 일수로 나눈 재발 구분(정해 둔 기준 — 피그플랜과 다르면 이 함수만 고치면 된다).
export function dayCategory(days: number, cause: string): (typeof DAY_ROWS)[number] {
  if (days >= EXPECTED_FARROWING_OFFSET) return "분만사불임"; // 분만예정일이 지나서 확인된 사고
  if (days <= 17) return "조기재발";
  if (days <= 24) return "1차재발";
  if (days <= 37) return "불규칙재발";
  if (days <= 44) return "2차재발";
  return cause === "공태" ? "공태" : "지연재발";
}
function causeRow(cause: string): (typeof CAUSE_ROWS)[number] {
  return (CAUSE_ROWS as readonly string[]).includes(cause) ? cause as (typeof CAUSE_ROWS)[number] : "재발";
}
function parityRow(parity: number) { return parity >= 8 ? "8산+" : `${Math.max(0, Math.floor(parity))}산`; }
function streakRow(streak: number) { return streak >= 4 ? "4회연속+" : streak === 1 ? "1회사고" : `${streak}회연속`; }

// 사고 기록 + (사고 기록 없이) 임신 중 도태·폐사된 모돈을 하나의 사고 목록으로 만든다.
export function collectIncidentEvents(matings: MatingRecord[], incidents: PregnancyIncidentRecord[], culls: CullRecord[], farrowings: FarrowingRecord[]): IncidentEvent[] {
  const byAnimal = new Map<string, MatingRecord[]>();
  [...matings].sort((left, right) => left.matingDate.localeCompare(right.matingDate) || left.id - right.id).forEach((record) => { const list = byAnimal.get(record.animalNo) ?? []; list.push(record); byAnimal.set(record.animalNo, list); });
  const lastMatingBefore = (animalNo: string, date: string) => (byAnimal.get(animalNo) ?? []).filter((record) => record.matingDate < date).at(-1);

  const events: Omit<IncidentEvent, "streak">[] = [];
  incidents.forEach((record) => {
    if (!record.incidentDate) return;
    const mating = lastMatingBefore(record.animalNo, record.incidentDate);
    const matingDate = record.matingDate && record.matingDate < record.incidentDate ? record.matingDate : mating?.matingDate ?? "";
    if (!matingDate) return;
    const matched = (byAnimal.get(record.animalNo) ?? []).find((item) => item.matingDate === matingDate);
    events.push({ animalNo: record.animalNo, matingDate, date: record.incidentDate, cause: record.cause, days: daysBetween(matingDate, record.incidentDate), parity: num(matched?.parity ?? record.parity), source: "incident" });
  });
  culls.forEach((record) => {
    if (record.type !== "도태" && record.type !== "폐사") return;
    const mating = lastMatingBefore(record.animalNo, record.eventDate);
    if (!mating || daysBetween(mating.matingDate, record.eventDate) > PREGNANT_CULL_LIMIT) return;
    const between = (date: string) => date > mating.matingDate && date <= record.eventDate;
    if (farrowings.some((item) => item.animalNo === record.animalNo && between(item.farrowingDate))) return;
    if (events.some((item) => item.animalNo === record.animalNo && item.matingDate === mating.matingDate)) return; // 이미 사고 기록이 있는 교배
    events.push({ animalNo: record.animalNo, matingDate: mating.matingDate, date: record.eventDate, cause: record.type, days: daysBetween(mating.matingDate, record.eventDate), parity: num(mating.parity), source: "cull" });
  });

  // 교배차수별: 마지막 분만 이후 연속으로 사고 난 횟수(이번 사고 포함).
  return events.map((event) => {
    const lastFarrowing = farrowings.filter((item) => item.animalNo === event.animalNo && item.farrowingDate <= event.matingDate).map((item) => item.farrowingDate).sort().at(-1) ?? "";
    const streak = events.filter((item) => item.animalNo === event.animalNo && item.matingDate > lastFarrowing && item.matingDate <= event.matingDate).length;
    return { ...event, streak: Math.max(1, streak) };
  });
}

export function buildIncidentAnalysis(periods: MatingPeriod[], events: IncidentEvent[]) {
  const perPeriod = periods.map((period) => events.filter((event) => event.date >= period.start && event.date <= period.end));
  const all = perPeriod.flat();
  const count = (key: string, group: string, label: string, test: (event: IncidentEvent) => boolean): IncidentRow => {
    const values = perPeriod.map((list) => list.filter(test).length);
    const total = values.reduce((sum, value) => sum + value, 0);
    return { key, group, label, kind: "count", values: values.map((value) => value || null), total: total || null, average: total ? round1(total / periods.length) : null };
  };
  const dayValues = perPeriod.map((list) => list.reduce((sum, event) => sum + event.days, 0));
  const totalDays = dayValues.reduce((sum, value) => sum + value, 0);
  const rows: IncidentRow[] = [
    count("total", "총사고두수", "총사고두수", () => true),
    ...CAUSE_ROWS.map((label) => count(`cause-${label}`, "구분별", label, (event) => causeRow(event.cause) === label)),
    ...DAY_ROWS.map((label) => count(`days-${label}`, "일수별", label, (event) => dayCategory(event.days, event.cause) === label)),
    { key: "totalDays", group: "총사고일수", label: "총사고일수", kind: "days", values: dayValues.map((value, index) => perPeriod[index].length ? value : null), total: all.length ? totalDays : null, average: all.length ? round1(totalDays / periods.length) : null },
    { key: "avgDays", group: "평균사고일수", label: "평균사고일수", kind: "average", values: perPeriod.map((list, index) => list.length ? round1(dayValues[index] / list.length) : null), total: all.length ? round1(totalDays / all.length) : null, average: all.length ? round1(totalDays / all.length) : null },
    ...PARITY_ROWS.map((label) => count(`parity-${label}`, "산차별", label, (event) => parityRow(event.parity) === label)),
    ...STREAK_ROWS.map((label) => count(`streak-${label}`, "교배차수별", label, (event) => streakRow(event.streak) === label)),
  ];
  return { rows, events: all };
}
