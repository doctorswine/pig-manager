import type { FarrowingRecord } from "../../production/sows/_data/farrowing-records";
import type { SowIntakeRecord } from "../../production/sows/_data/intake-records";
import type { MatingRecord } from "../../production/sows/_data/mating-records";
import type { WeaningRecord } from "../../production/sows/_data/weaning-records";

// 초교배일령별 성적·분포(피그플랜 "초교배일령별성적(전체)", 피그지오 "초교배일령별 분포" 양식).
// 초교배일령 = 첫 교배일(산차 0 교배 중 가장 이른 날) − 출생일(전입 기록). 평균초교배일령 정의는 매뉴얼 p.228.

export type AgeBin = { label: string; min: number; max: number };
function bins(firstMax: number, lastMin: number): AgeBin[] {
  const list: AgeBin[] = [{ label: `${firstMax} 이하`, min: -Infinity, max: firstMax }];
  for (let from = firstMax + 1; from < lastMin; from += 10) list.push({ label: `${from}~${from + 9}`, min: from, max: from + 9 });
  list.push({ label: `${lastMin} 이상`, min: lastMin, max: Infinity });
  return list;
}
export const RESULT_BINS = bins(180, 301); // 성적: 180 이하, 181~190 … 291~300, 301 이상
export const DISTRIBUTION_BINS = bins(200, 301); // 분포: 200 이하, 201~210 … 291~300, 301 이상

function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); }
const num = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const isDate = (value: string | undefined) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const binIndex = (list: AgeBin[], age: number) => list.findIndex((bin) => age >= bin.min && age <= bin.max);

export type FirstMatingSow = { animalNo: string; breed: string; birthDate: string; firstMatingDate: string; age: number };
export type FirstLitter = FirstMatingSow & { farrowingDate: string; totalBorn: number; liveBorn: number; weaned: number | null; returnDays: number | null };

export function collectFirstMatings(intakes: SowIntakeRecord[], matings: MatingRecord[]): FirstMatingSow[] {
  const sorted = [...matings].sort((left, right) => left.matingDate.localeCompare(right.matingDate) || left.id - right.id);
  const result: FirstMatingSow[] = [];
  const seen = new Set<string>();
  sorted.forEach((mating) => {
    if (seen.has(mating.animalNo)) return; seen.add(mating.animalNo);
    if (num(mating.parity) !== 0) return; // 경산돈으로 전입해 처음 기록된 교배는 초교배가 아니다
    const intake = intakes.find((record) => record.animalNo === mating.animalNo && isDate(record.birthDate));
    if (!intake || !isDate(mating.matingDate)) return;
    const age = daysBetween(intake.birthDate, mating.matingDate);
    if (age <= 0) return;
    result.push({ animalNo: mating.animalNo, breed: intake.breed || mating.breed || "", birthDate: intake.birthDate, firstMatingDate: mating.matingDate, age });
  });
  return result;
}

// 초산 성적: 초교배 이후 첫 분만, 그 분만의 이유, 이유 후 첫 교배(재귀일).
export function collectFirstLitters(firsts: FirstMatingSow[], matings: MatingRecord[], farrowings: FarrowingRecord[], weanings: WeaningRecord[]): FirstLitter[] {
  return firsts.flatMap((sow) => {
    const own = farrowings.filter((record) => record.animalNo === sow.animalNo && isDate(record.farrowingDate) && record.farrowingDate > sow.firstMatingDate).sort((left, right) => left.farrowingDate.localeCompare(right.farrowingDate));
    const farrowing = own[0]; if (!farrowing) return [];
    const nextFarrowing = own[1]?.farrowingDate;
    const weaning = weanings.filter((record) => record.animalNo === sow.animalNo && record.weaningDate >= farrowing.farrowingDate && (!nextFarrowing || record.weaningDate < nextFarrowing) && (!record.farrowingDate || record.farrowingDate === farrowing.farrowingDate)).sort((left, right) => left.weaningDate.localeCompare(right.weaningDate))[0];
    const remating = weaning ? matings.filter((record) => record.animalNo === sow.animalNo && record.matingDate >= weaning.weaningDate && (!nextFarrowing || record.matingDate < nextFarrowing)).map((record) => record.matingDate).sort()[0] : undefined;
    return [{ ...sow, farrowingDate: farrowing.farrowingDate, totalBorn: num(farrowing.totalBorn), liveBorn: num(farrowing.liveFemale) + num(farrowing.liveMale), weaned: weaning ? num(weaning.femaleCount) + num(weaning.maleCount) : null, returnDays: weaning && remating ? daysBetween(weaning.weaningDate, remating) : null }];
  });
}

export type AgeRow = { key: string; label: string; values: Array<number | null>; total: number | null; digits: number };

export function buildFirstMatingAge(range: { start: string; end: string }, breed: string, data: { intakes: SowIntakeRecord[]; matings: MatingRecord[]; farrowings: FarrowingRecord[]; weanings: WeaningRecord[] }) {
  const firsts = collectFirstMatings(data.intakes, data.matings).filter((sow) => !breed || sow.breed === breed);
  // 성적: 산출기간 안에 분만한 초산(피그플랜은 분만기간으로 조회)
  const litters = collectFirstLitters(firsts, data.matings, data.farrowings, data.weanings).filter((item) => item.farrowingDate >= range.start && item.farrowingDate <= range.end);
  const byBin = RESULT_BINS.map((bin) => litters.filter((item) => item.age >= bin.min && item.age <= bin.max));
  const mean = (list: number[]) => list.length ? round1(list.reduce((a, b) => a + b, 0) / list.length) : null;
  const row = (key: string, label: string, pick: (list: FirstLitter[]) => number | null, digits: number): AgeRow => ({ key, label, values: byBin.map((list) => { const value = pick(list); return value ? value : null; }), total: pick(litters) || null, digits });
  const resultRows: AgeRow[] = [
    row("farrowings", "분만복수", (list) => list.length, 0),
    row("avgTotal", "평균 총산", (list) => mean(list.map((item) => item.totalBorn)), 1),
    row("avgLive", "평균 실산", (list) => mean(list.map((item) => item.liveBorn)), 1),
    row("returns", "재귀복수", (list) => list.filter((item) => item.returnDays !== null).length, 0),
    row("avgReturn", "평균 재귀일", (list) => mean(list.filter((item) => item.returnDays !== null).map((item) => item.returnDays!)), 1),
    row("avgWeaned", "평균 이유두수", (list) => mean(list.filter((item) => item.weaned !== null).map((item) => item.weaned!)), 1),
  ];
  // 분포: 산출기간 안에 초교배한 모돈 두수
  const mated = firsts.filter((sow) => sow.firstMatingDate >= range.start && sow.firstMatingDate <= range.end);
  const counts = DISTRIBUTION_BINS.map(() => 0); mated.forEach((sow) => { const index = binIndex(DISTRIBUTION_BINS, sow.age); if (index >= 0) counts[index] += 1; });
  const distributionRow: AgeRow = { key: "count", label: "돼지두수", values: counts.map((value) => value || null), total: mated.length || null, digits: 0 };
  const avgAge = mated.length ? round1(mated.reduce((sum, sow) => sum + sow.age, 0) / mated.length) : null;
  // 출생일이 없어 초교배일령을 계산하지 못한 초교배(산출기간 안) 두수 — 화면 안내용
  const counted = new Set(firsts.map((sow) => sow.animalNo));
  const firstByAnimal = new Map<string, MatingRecord>();
  [...data.matings].sort((left, right) => left.matingDate.localeCompare(right.matingDate) || left.id - right.id).forEach((record) => { if (!firstByAnimal.has(record.animalNo)) firstByAnimal.set(record.animalNo, record); });
  const missingBirth = [...firstByAnimal.values()].filter((record) => num(record.parity) === 0 && !counted.has(record.animalNo) && record.matingDate >= range.start && record.matingDate <= range.end && (!breed || record.breed === breed || data.intakes.some((intake) => intake.animalNo === record.animalNo && intake.breed === breed))).length;
  return { resultRows, distributionRow, litterCount: litters.length, matedCount: mated.length, avgAge, missingBirth };
}
