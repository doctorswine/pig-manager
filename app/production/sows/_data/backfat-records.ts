export const BACKFAT_RECORDS_STORAGE_KEY = "pig-manager:backfat-records";

export const BACKFAT_MEASUREMENT_TIMINGS = [
  "직접입력",
  "교배일",
  "임신 30일",
  "임신 90일",
  "분만 전",
  "이유 전",
] as const;

export type BackfatMeasurementTiming = (typeof BACKFAT_MEASUREMENT_TIMINGS)[number];

export type SowBackfatRecord = {
  id: number;
  animalNo: string;
  earTag: string;
  breed: string;
  parity: string;
  status: string;
  measurementDate: string;
  measurementTiming: BackfatMeasurementTiming;
  measurementTimingDetail?: string;
  weight: string;
  backfat: string;
  note: string;
};

export const defaultBackfatRecords: SowBackfatRecord[] = [
  { id: 1, animalNo: "2960", earTag: "7062", breed: "YL", parity: "0", status: "후보돈", measurementDate: "2026-09-20", measurementTiming: "직접입력", measurementTimingDetail: "후보돈 점검", weight: "119", backfat: "13.5", note: "후보돈 체형 확인" },
  { id: 2, animalNo: "2933", earTag: "6633", breed: "YL", parity: "0", status: "후보돈", measurementDate: "2026-09-18", measurementTiming: "임신 30일", weight: "118", backfat: "14.2", note: "" },
  { id: 3, animalNo: "2934", earTag: "6657", breed: "YL", parity: "0", status: "후보돈", measurementDate: "2026-09-12", measurementTiming: "교배일", weight: "116", backfat: "13.8", note: "" },
];

export function readStoredBackfatRecords() {
  if (typeof window === "undefined") return defaultBackfatRecords;

  try {
    const stored = window.localStorage.getItem(BACKFAT_RECORDS_STORAGE_KEY);
    if (!stored) return defaultBackfatRecords;
    const records = JSON.parse(stored) as SowBackfatRecord[];
    return Array.isArray(records) ? records : defaultBackfatRecords;
  } catch {
    return defaultBackfatRecords;
  }
}

export function storeBackfatRecords(records: SowBackfatRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BACKFAT_RECORDS_STORAGE_KEY, JSON.stringify(records));
}
