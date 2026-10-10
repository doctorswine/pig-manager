import type { FarrowingRecord } from "../../production/sows/_data/farrowing-records";
import type { MatingRecord } from "../../production/sows/_data/mating-records";
import type { WeaningRecord } from "../../production/sows/_data/weaning-records";
import type { MatingPeriod } from "./mating-results";

// 교배목표 달성율(피그플랜 교배목표 달성율 양식) 계산
export type MatingTargets = { farrowingTarget: number | null; farrowingRate: number | null; weanedPerLitter: number | null };
export type MatingTargetRow = MatingPeriod & {
  matings: number; matingVsTarget: number | null;
  // 분만·이유는 그 구간에 교배한 모돈(코호트)의 결과다. 분만예정일이 산출 종료일보다 뒤면 아직 결과가 없으므로 null.
  matured: boolean; farrowings: number | null; farrowingVsTarget: number | null; farrowingRate: number | null;
  weaned: number | null; weanedVsTarget: number | null;
};
export type MatingTargetSummary = {
  matingTarget: number | null; weanedTarget: number | null;
  totals: { matings: number; matingVsTarget: number | null; farrowings: number; farrowingVsTarget: number | null; farrowingRate: number | null; weaned: number; weanedVsTarget: number | null };
  stdDev: { matingVsTarget: number | null; farrowingVsTarget: number | null; weanedVsTarget: number | null };
  variance: { matingVsTarget: number | null; farrowingVsTarget: number | null; weanedVsTarget: number | null };
};

const EXPECTED_FARROWING_OFFSET = 114; // 교배일 1일차 기준 115일째
function addDays(text: string, days: number) { const date = new Date(`${text}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function pct(value: number, base: number | null) { return base ? Math.round((value / base) * 100) : null; }
function spread(values: Array<number | null>) {
  const list = values.filter((value): value is number => value !== null);
  if (!list.length) return { sd: null, variance: null };
  const mean = list.reduce((sum, value) => sum + value, 0) / list.length;
  const variance = list.reduce((sum, value) => sum + (value - mean) ** 2, 0) / list.length;
  return { sd: Math.round(Math.sqrt(variance)), variance: Math.round(variance) };
}

// 목표교배 = 분만목표 ÷ 목표분만율, 목표이유 = 분만목표 × 복당목표이유 (빈칸이면 해당 목표대비를 계산하지 않음)
export function deriveTargets(targets: MatingTargets) {
  const matingTarget = targets.farrowingTarget && targets.farrowingRate ? targets.farrowingTarget / (targets.farrowingRate / 100) : null;
  const weanedTarget = targets.farrowingTarget && targets.weanedPerLitter ? targets.farrowingTarget * targets.weanedPerLitter : null;
  return { matingTarget, weanedTarget };
}

export function buildMatingTarget(periods: MatingPeriod[], targets: MatingTargets, matings: MatingRecord[], farrowings: FarrowingRecord[], weanings: WeaningRecord[]) {
  const { matingTarget, weanedTarget } = deriveTargets(targets);
  const endDate = periods.at(-1)?.end ?? "";
  const sortedMatings = [...matings].sort((left, right) => left.matingDate.localeCompare(right.matingDate) || left.id - right.id);
  // 교배 한 건의 결과: 다음 교배 전까지 처음 나온 분만과 그 분만의 이유 두수
  const outcome = (mating: MatingRecord) => {
    const next = sortedMatings.find((record) => record.animalNo === mating.animalNo && (record.matingDate > mating.matingDate || (record.matingDate === mating.matingDate && record.id > mating.id)));
    const farrowing = farrowings.filter((record) => record.animalNo === mating.animalNo && record.farrowingDate > mating.matingDate && record.farrowingDate <= endDate && (!next || record.farrowingDate <= next.matingDate)).sort((left, right) => left.farrowingDate.localeCompare(right.farrowingDate))[0];
    if (!farrowing) return { farrowed: false, weaned: 0 };
    const weaning = weanings.filter((record) => record.animalNo === mating.animalNo && record.weaningDate >= farrowing.farrowingDate && record.weaningDate <= endDate && (!record.farrowingDate || record.farrowingDate === farrowing.farrowingDate)).sort((left, right) => left.weaningDate.localeCompare(right.weaningDate))[0];
    return { farrowed: true, weaned: weaning ? num(weaning.femaleCount) + num(weaning.maleCount) : 0 };
  };

  const rows: MatingTargetRow[] = periods.map((period) => {
    const cohort = sortedMatings.filter((record) => record.matingDate >= period.start && record.matingDate <= period.end);
    const matured = addDays(period.end, EXPECTED_FARROWING_OFFSET) <= endDate;
    const results = cohort.map(outcome);
    const farrowingCount = results.filter((result) => result.farrowed).length;
    const weanedCount = results.reduce((sum, result) => sum + result.weaned, 0);
    return {
      ...period, matings: cohort.length, matingVsTarget: pct(cohort.length, matingTarget), matured,
      farrowings: matured ? farrowingCount : null, farrowingVsTarget: matured ? pct(farrowingCount, targets.farrowingTarget) : null,
      farrowingRate: matured && cohort.length ? Math.round((farrowingCount / cohort.length) * 100) : null,
      weaned: matured ? weanedCount : null, weanedVsTarget: matured ? pct(weanedCount, weanedTarget) : null,
    };
  });

  const maturedRows = rows.filter((row) => row.matured);
  const totalMatings = rows.reduce((sum, row) => sum + row.matings, 0);
  const maturedMatings = maturedRows.reduce((sum, row) => sum + row.matings, 0);
  const totalFarrowings = maturedRows.reduce((sum, row) => sum + (row.farrowings ?? 0), 0);
  const totalWeaned = maturedRows.reduce((sum, row) => sum + (row.weaned ?? 0), 0);
  const mating = spread(rows.map((row) => row.matingVsTarget)); const farrowing = spread(maturedRows.map((row) => row.farrowingVsTarget)); const weaned = spread(maturedRows.map((row) => row.weanedVsTarget));
  const summary: MatingTargetSummary = {
    matingTarget, weanedTarget,
    totals: {
      matings: totalMatings, matingVsTarget: matingTarget ? pct(totalMatings, matingTarget * rows.length) : null,
      farrowings: totalFarrowings, farrowingVsTarget: targets.farrowingTarget && maturedRows.length ? pct(totalFarrowings, targets.farrowingTarget * maturedRows.length) : null,
      farrowingRate: maturedMatings ? Math.round((totalFarrowings / maturedMatings) * 100) : null,
      weaned: totalWeaned, weanedVsTarget: weanedTarget && maturedRows.length ? pct(totalWeaned, weanedTarget * maturedRows.length) : null,
    },
    stdDev: { matingVsTarget: mating.sd, farrowingVsTarget: farrowing.sd, weanedVsTarget: weaned.sd },
    variance: { matingVsTarget: mating.variance, farrowingVsTarget: farrowing.variance, weanedVsTarget: weaned.variance },
  };
  return { rows, summary };
}
