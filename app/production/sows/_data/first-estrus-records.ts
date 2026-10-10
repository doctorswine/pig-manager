export const FIRST_ESTRUS_RECORDS_STORAGE_KEY = "pig-manager:first-estrus-records";

export type CycleEntry = {
  heatDate: string;
  weight: string;
  backfat: string;
  intensity: string;
  note: string;
};

export type EstrusRecord = {
  id: number;
  animalNo: string;
  earTag: string;
  breed: string;
  cycles: CycleEntry[];
};

export const blankEstrusCycle = (): CycleEntry => ({ heatDate: "", weight: "", backfat: "", intensity: "정상발정", note: "" });
export const blankEstrusCycles = () => Array.from({ length: 4 }, blankEstrusCycle);

export const defaultFirstEstrusRecords: EstrusRecord[] = [
  { id: 1, animalNo: "2931", earTag: "6508", breed: "F1", cycles: [
    { heatDate: "2026-08-26", weight: "112", backfat: "13.2", intensity: "정상발정", note: "발정 반응 양호" },
    { heatDate: "2026-09-16", weight: "118", backfat: "13.8", intensity: "정상발정", note: "" },
    blankEstrusCycle(), blankEstrusCycle(),
  ] },
  { id: 2, animalNo: "2932", earTag: "6644", breed: "F1", cycles: [
    { heatDate: "2026-09-02", weight: "110", backfat: "12.6", intensity: "미약발정", note: "초발정 확인" },
    blankEstrusCycle(), blankEstrusCycle(), blankEstrusCycle(),
  ] },
  { id: 3, animalNo: "2938", earTag: "66135", breed: "F1", cycles: [
    { heatDate: "2026-08-30", weight: "115", backfat: "13.5", intensity: "정상발정", note: "" },
    { heatDate: "2026-09-19", weight: "121", backfat: "14.1", intensity: "이상발정", note: "2차 확인" },
    blankEstrusCycle(), blankEstrusCycle(),
  ] },
];

export function readStoredFirstEstrusRecords() {
  if (typeof window === "undefined") return defaultFirstEstrusRecords;
  try {
    const stored = window.localStorage.getItem(FIRST_ESTRUS_RECORDS_STORAGE_KEY);
    if (!stored) return defaultFirstEstrusRecords;
    const records = JSON.parse(stored) as EstrusRecord[];
    return Array.isArray(records) ? records : defaultFirstEstrusRecords;
  } catch {
    return defaultFirstEstrusRecords;
  }
}

export function writeStoredFirstEstrusRecords(records: EstrusRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FIRST_ESTRUS_RECORDS_STORAGE_KEY, JSON.stringify(records));
}