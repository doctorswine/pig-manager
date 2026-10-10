import type { MatingRecord } from "../../production/sows/_data/mating-records";
import type { PregnancyIncidentRecord } from "../../production/sows/_data/pregnancy-incident-records";
import type { SowIntakeRecord } from "../../production/sows/_data/intake-records";
import type { WeaningRecord } from "../../production/sows/_data/weaning-records";

// 교배실적(피그지오 교배실적 양식) 계산
export type MatingPeriod = { label: string; start: string; end: string };
export type MatingRowKind = "count" | "average" | "rate";
export type MatingRowDef = { key: string; group: string; label: string; kind: MatingRowKind; base?: string; digits?: number };
export type MatingResultRow = MatingRowDef & { values: Array<number | null>; total: number | null; average: number | null; ratio: number | null };

type Classified = {
  date: string; parity: number;
  services: 1 | 2 | 3; method: "natural" | "artificial" | "mixed";
  estrus: "normal" | "repeat1" | "repeat2" | "otherIncident";
  firstMatingAge: number | null; returnDays: number | null;
};

export const MATING_ROWS: MatingRowDef[] = [
  { key: "total", group: "", label: "교배복수", kind: "count", base: "total" },
  { key: "service1", group: "차수", label: "1차", kind: "count", base: "total" },
  { key: "service2", group: "차수", label: "2차", kind: "count", base: "total" },
  { key: "service3", group: "차수", label: "3차", kind: "count", base: "total" },
  { key: "natural", group: "방법", label: "순자연교배", kind: "count", base: "total" },
  { key: "artificial", group: "방법", label: "순인공교배", kind: "count", base: "total" },
  { key: "mixed", group: "방법", label: "혼합교배", kind: "count", base: "total" },
  { key: "normal", group: "발정구분", label: "정상교배", kind: "count", base: "total" },
  { key: "repeat1", group: "발정구분", label: "1차재발", kind: "count", base: "total" },
  { key: "repeat2", group: "발정구분", label: "2차재발", kind: "count", base: "total" },
  { key: "otherIncident", group: "발정구분", label: "기타사고후교배", kind: "count", base: "total" },
  { key: "giltNormal", group: "미경산돈", label: "정상교배", kind: "count", base: "gilt" },
  { key: "giltRepeat", group: "미경산돈", label: "재발교배", kind: "count", base: "gilt" },
  { key: "giltOther", group: "미경산돈", label: "기타사고후교배", kind: "count", base: "gilt" },
  { key: "firstMatingAge", group: "미경산돈", label: "초교배일", kind: "average", digits: 0 },
  { key: "sowNormal", group: "경산돈", label: "정상교배", kind: "count", base: "sow" },
  { key: "sowRepeat", group: "경산돈", label: "재발교배", kind: "count", base: "sow" },
  { key: "sowOther", group: "경산돈", label: "기타사고후교배", kind: "count", base: "sow" },
  { key: "returnDays", group: "경산돈", label: "평균재귀일", kind: "average", digits: 1 },
  { key: "return3", group: "재귀일분포", label: "3일이하", kind: "count", base: "total" },
  { key: "return4", group: "재귀일분포", label: "4일", kind: "count", base: "total" },
  { key: "return5", group: "재귀일분포", label: "5일", kind: "count", base: "total" },
  { key: "return6", group: "재귀일분포", label: "6일", kind: "count", base: "total" },
  { key: "return7", group: "재귀일분포", label: "7일", kind: "count", base: "total" },
  { key: "returnWithin7", group: "재귀일분포", label: "소계", kind: "count", base: "total" },
  { key: "return8", group: "재귀일분포", label: "8일", kind: "count", base: "total" },
  { key: "return9", group: "재귀일분포", label: "9일", kind: "count", base: "total" },
  { key: "return10", group: "재귀일분포", label: "10일이상", kind: "count", base: "total" },
  { key: "rate7", group: "", label: "7일내 재귀율(%)", kind: "rate", digits: 1 },
  { key: "rate46", group: "", label: "4~6일 재귀율(%)", kind: "rate", digits: 1 },
];

function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function round(value: number, digits: number) { const factor = 10 ** digits; return Math.round(value * factor) / factor; }
function isDate(value: string | undefined) { return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)); }

// 교배 기록마다 차수·방법·발정구분·초교배일령·재귀일을 정한다.
export function classifyMatings(matings: MatingRecord[], incidents: PregnancyIncidentRecord[], intakes: SowIntakeRecord[], weanings: WeaningRecord[]): Classified[] {
  const sorted = [...matings].sort((left, right) => left.matingDate.localeCompare(right.matingDate) || left.id - right.id);
  const repeatChain = new Map<string, number>(); // 모돈·산차별 연속 재발 교배 횟수
  return sorted.map((mating, index) => {
    const parity = num(mating.parity);
    const services = ([mating.boar2, mating.boar3].filter((boar) => boar && boar.trim()).length + 1) as 1 | 2 | 3;
    const usedMethods = [mating.method1, mating.boar2 ? mating.method2 : "", mating.boar3 ? mating.method3 : ""].filter(Boolean);
    const method = usedMethods.every((item) => item === "자연") ? "natural" : usedMethods.every((item) => item !== "자연") ? "artificial" : "mixed";
    const previous = sorted.slice(0, index).filter((record) => record.animalNo === mating.animalNo && num(record.parity) === parity).at(-1);
    const chainKey = `${mating.animalNo}|${parity}`;
    let estrus: Classified["estrus"] = "normal";
    if (previous) {
      // 같은 산차에서 다시 교배: 그 사이의 임신사고 원인으로 재발과 기타사고를 나눈다(사고 기록이 없으면 재발로 본다).
      const incident = incidents.filter((record) => record.animalNo === mating.animalNo && record.incidentDate >= previous.matingDate && record.incidentDate <= mating.matingDate).sort((left, right) => right.incidentDate.localeCompare(left.incidentDate))[0];
      if (!incident || incident.cause === "재발") {
        const chain = (repeatChain.get(chainKey) ?? 0) + 1; repeatChain.set(chainKey, chain);
        estrus = chain === 1 ? "repeat1" : "repeat2";
      } else { estrus = "otherIncident"; repeatChain.set(chainKey, 0); }
    } else repeatChain.set(chainKey, 0);
    const intake = intakes.find((record) => record.animalNo === mating.animalNo);
    const firstMatingAge = parity === 0 && estrus === "normal" && intake && isDate(intake.birthDate) ? daysBetween(intake.birthDate, mating.matingDate) : null;
    const weaning = parity > 0 && estrus === "normal" ? weanings.filter((record) => record.animalNo === mating.animalNo && record.weaningDate <= mating.matingDate).sort((left, right) => right.weaningDate.localeCompare(left.weaningDate))[0] : undefined;
    const returnDays = weaning ? daysBetween(weaning.weaningDate, mating.matingDate) : null;
    return { date: mating.matingDate, parity, services, method, estrus, firstMatingAge, returnDays };
  });
}

function metrics(items: Classified[]) {
  const count = (predicate: (item: Classified) => boolean) => items.filter(predicate).length;
  const gilt = items.filter((item) => item.parity === 0); const sow = items.filter((item) => item.parity > 0);
  const ages = items.map((item) => item.firstMatingAge).filter((value): value is number => value !== null);
  const returns = items.map((item) => item.returnDays).filter((value): value is number => value !== null);
  const returnCount = (from: number, to: number) => returns.filter((value) => value >= from && value <= to).length;
  const within7 = returnCount(-Infinity, 7); const within46 = returnCount(4, 6);
  const sowNormal = sow.filter((item) => item.estrus === "normal").length;
  const values: Record<string, number | null> = {
    total: items.length,
    service1: count((item) => item.services === 1), service2: count((item) => item.services === 2), service3: count((item) => item.services === 3),
    natural: count((item) => item.method === "natural"), artificial: count((item) => item.method === "artificial"), mixed: count((item) => item.method === "mixed"),
    normal: count((item) => item.estrus === "normal"), repeat1: count((item) => item.estrus === "repeat1"), repeat2: count((item) => item.estrus === "repeat2"), otherIncident: count((item) => item.estrus === "otherIncident"),
    giltNormal: gilt.filter((item) => item.estrus === "normal").length, giltRepeat: gilt.filter((item) => item.estrus === "repeat1" || item.estrus === "repeat2").length, giltOther: gilt.filter((item) => item.estrus === "otherIncident").length,
    firstMatingAge: ages.length ? round(ages.reduce((sum, value) => sum + value, 0) / ages.length, 0) : null,
    sowNormal, sowRepeat: sow.filter((item) => item.estrus === "repeat1" || item.estrus === "repeat2").length, sowOther: sow.filter((item) => item.estrus === "otherIncident").length,
    returnDays: returns.length ? round(returns.reduce((sum, value) => sum + value, 0) / returns.length, 1) : null,
    return3: returnCount(-Infinity, 3), return4: returnCount(4, 4), return5: returnCount(5, 5), return6: returnCount(6, 6), return7: returnCount(7, 7), returnWithin7: within7,
    return8: returnCount(8, 8), return9: returnCount(9, 9), return10: returnCount(10, Infinity),
    // 재귀율은 재귀일을 알 수 있는 경산돈 정상교배 두수 대비
    rate7: returns.length ? round((within7 / returns.length) * 100, 1) : null,
    rate46: returns.length ? round((within46 / returns.length) * 100, 1) : null,
  };
  const bases: Record<string, number> = { total: items.length, gilt: gilt.length, sow: sow.length };
  return { values, bases, sowNormal };
}

export function buildMatingResults(classified: Classified[], periods: MatingPeriod[], options: { withSummary: boolean }) {
  const inRange = (start: string, end: string) => classified.filter((item) => item.date >= start && item.date <= end);
  const perPeriod = periods.map((period) => metrics(inRange(period.start, period.end)));
  const first = periods[0]?.start ?? ""; const last = periods.at(-1)?.end ?? "";
  const overall = metrics(inRange(first, last));
  const rows: MatingResultRow[] = MATING_ROWS.map((row) => {
    const values = perPeriod.map((period) => period.values[row.key] ?? null);
    if (!options.withSummary) return { ...row, values, total: null, average: null, ratio: null };
    // 합계: 두수 행은 기간 합계, 평균·비율 행은 전체 기간으로 다시 계산한 값
    const total = row.kind === "count" ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) : overall.values[row.key] ?? null;
    const present = values.filter((value): value is number => value !== null);
    const average = row.kind === "count" ? (periods.length ? round((total ?? 0) / periods.length, 1) : null) : present.length ? round(present.reduce((sum, value) => sum + value, 0) / present.length, row.digits ?? 1) : null;
    const baseValue = row.base ? overall.bases[row.base] : 0;
    const ratio = row.kind === "count" && row.base ? (baseValue ? round(((total ?? 0) / baseValue) * 100, 1) : null) : null;
    return { ...row, values, total, average, ratio };
  });
  return { rows, start: first, end: last };
}

// ----- 기간 만들기 -----
export type PeriodUnit = "day" | "week" | "month" | "year";
function addDays(text: string, days: number) { const date = new Date(`${text}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function monthStart(year: number, month: number) { const date = new Date(Date.UTC(year, month - 1, 1)); return date.toISOString().slice(0, 10); }
function monthEnd(year: number, month: number) { const date = new Date(Date.UTC(year, month, 0)); return date.toISOString().slice(0, 10); }
function shiftMonth(year: number, month: number, delta: number) { const index = year * 12 + (month - 1) + delta; return { year: Math.floor(index / 12), month: (index % 12) + 1 }; }
const short = (text: string) => text.slice(5); // MM-DD
const yymm = (year: number, month: number) => `${String(year).slice(2)}-${String(month).padStart(2, "0")}`;

// 일자별 교배실적: 조회기준일을 마지막으로 단위 길이의 구간을 기간 수만큼 거꾸로 만든다(월·년은 달력 기준).
export function dailyPeriods(baseDate: string, periodCount: number, unitCount: number, unit: PeriodUnit, maxUnit = 12): MatingPeriod[] {
  const periods: MatingPeriod[] = [];
  const n = Math.min(52, Math.max(1, periodCount)); const u = Math.min(maxUnit, Math.max(1, unitCount));
  if (unit === "day" || unit === "week") {
    const length = unit === "day" ? u : u * 7;
    for (let index = 0; index < n; index += 1) {
      const end = addDays(baseDate, -index * length); const start = addDays(end, -(length - 1));
      periods.unshift({ label: length === 1 ? short(end) : `${short(start)}~${short(end)}`, start, end });
    }
    return periods;
  }
  const year = Number(baseDate.slice(0, 4)); const month = Number(baseDate.slice(5, 7));
  for (let index = 0; index < n; index += 1) {
    if (unit === "month") {
      const endMonth = shiftMonth(year, month, -index * u); const startMonth = shiftMonth(endMonth.year, endMonth.month, -(u - 1));
      const end = index === 0 ? baseDate : monthEnd(endMonth.year, endMonth.month);
      periods.unshift({ label: u === 1 ? yymm(endMonth.year, endMonth.month) : `${yymm(startMonth.year, startMonth.month)}~${yymm(endMonth.year, endMonth.month)}`, start: monthStart(startMonth.year, startMonth.month), end });
    } else {
      const endYear = year - index * u; const startYear = endYear - (u - 1);
      const end = index === 0 ? baseDate : `${endYear}-12-31`;
      periods.unshift({ label: u === 1 ? String(endYear) : `${startYear}~${endYear}`, start: `${startYear}-01-01`, end });
    }
  }
  return periods;
}

// 시계열 교배실적: 조회기준월을 끝으로 1년·9개월·6개월·3개월·당월 누계
export function seriesPeriods(year: number, month: number): MatingPeriod[] {
  const windows: Array<[string, number]> = [["1년", 12], ["9개월", 9], ["6개월", 6], ["3개월", 3], ["당월", 1]];
  const label = (y: number, m: number) => `${String(y).slice(2)}.${String(m).padStart(2, "0")}`;
  return windows.map(([name, months]) => {
    const start = shiftMonth(year, month, -(months - 1));
    return { label: `${name}(${label(start.year, start.month)}~${label(year, month)})`, start: monthStart(start.year, start.month), end: monthEnd(year, month) };
  });
}
