import type { SowIntakeRecord } from "../../production/sows/_data/intake-records";
import type { MatingRecord } from "../../production/sows/_data/mating-records";
import type { WeaningRecord } from "../../production/sows/_data/weaning-records";
import type { MatingPeriod } from "./mating-results";

// 평균발정재귀일령분석(피그플랜 6.4.5.3, 매뉴얼 p.255): 산출기간 동안 교배한 모돈의 이전 이유일 → 교배일.
// 재귀일은 경산돈(산차 1 이상)의 이유 후 첫 교배(그 산차의 첫 교배 = 정상교배)에서만 센다(매뉴얼 p.193·228).

export const RETURN_BINS = [
  { label: "0~3일", min: 0, max: 3 }, { label: "4~6일", min: 4, max: 6 }, { label: "7~9일", min: 7, max: 9 },
  { label: "10~22일", min: 10, max: 22 }, { label: "23~29일", min: 23, max: 29 }, { label: "30일+", min: 30, max: Infinity },
];
export const PARITY_LABELS = ["0", "1", "2", "3", "4", "5", "6", "7", "8+"];

export type ReturnMating = { animalNo: string; breed: string; date: string; parity: number; weaningDate: string; days: number };

function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); }
const num = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const round = (value: number, digits: number) => { const factor = 10 ** digits; return Math.round(value * factor) / factor; };

export function collectReturnMatings(intakes: SowIntakeRecord[], matings: MatingRecord[], weanings: WeaningRecord[]): ReturnMating[] {
  const sorted = [...matings].filter((record) => record.matingDate).sort((left, right) => left.matingDate.localeCompare(right.matingDate) || left.id - right.id);
  const breedOf = (record: MatingRecord) => intakes.find((intake) => intake.animalNo === record.animalNo && intake.breed)?.breed || record.breed || "";
  return sorted.flatMap((mating, index) => {
    const parity = num(mating.parity); if (parity < 1) return [];
    const earlier = sorted.slice(0, index).filter((record) => record.animalNo === mating.animalNo);
    if (earlier.some((record) => num(record.parity) === parity)) return []; // 같은 산차의 재교배(재발 등)는 재귀일 계산 제외
    const previousMating = earlier.at(-1)?.matingDate ?? "";
    const weaning = weanings.filter((record) => record.animalNo === mating.animalNo && record.weaningDate && record.weaningDate <= mating.matingDate && record.weaningDate > previousMating).map((record) => record.weaningDate).sort().at(-1);
    if (!weaning) return [];
    return [{ animalNo: mating.animalNo, breed: breedOf(mating), date: mating.matingDate, parity, weaningDate: weaning, days: daysBetween(weaning, mating.matingDate) }];
  });
}

export function buildReturnToEstrus(periods: MatingPeriod[], breed: string, data: { intakes: SowIntakeRecord[]; matings: MatingRecord[]; weanings: WeaningRecord[] }) {
  const all = collectReturnMatings(data.intakes, data.matings, data.weanings).filter((item) => !breed || item.breed === breed);
  const start = periods[0]?.start ?? ""; const end = periods.at(-1)?.end ?? "";
  const inRange = all.filter((item) => item.date >= start && item.date <= end);
  const mean = (list: ReturnMating[], digits: number) => list.length ? round(list.reduce((sum, item) => sum + item.days, 0) / list.length, digits) : null;
  // ① 기간별 평균발정재귀일령
  const periodValues = periods.map((period) => mean(inRange.filter((item) => item.date >= period.start && item.date <= period.end), 1));
  const periodCounts = periods.map((period) => inRange.filter((item) => item.date >= period.start && item.date <= period.end).length);
  // ② 일령별·산차별 교배복수와 평균발정재귀일령
  const parityIndex = (parity: number) => Math.min(8, parity);
  const parityRows = PARITY_LABELS.map((label, index) => {
    const list = inRange.filter((item) => parityIndex(item.parity) === index);
    return { label, counts: RETURN_BINS.map((bin) => list.filter((item) => item.days >= bin.min && item.days <= bin.max).length), total: list.length, average: mean(list, 2) };
  });
  const totalRow = { label: "합계", counts: RETURN_BINS.map((_, index) => parityRows.reduce((sum, row) => sum + row.counts[index], 0)), total: inRange.length, average: mean(inRange, 2) };
  return { periodValues, periodCounts, overall: mean(inRange, 1), parityRows, totalRow, count: inRange.length };
}
