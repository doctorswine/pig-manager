export const FATTENING_MORTALITY_RECORDS_STORAGE_KEY = "pig-manager:fattening-mortality-records";

export const FATTENING_MORTALITY_CAUSES = [
  "위축",
  "도태",
  "호흡기",
  "소화기",
  "관절/기립불능",
  "헤르니아",
  "신경증상",
  "기타",
] as const;

export type FatteningMortalityCause = (typeof FATTENING_MORTALITY_CAUSES)[number];

export type FatteningMortalityRecord = {
  id: number;
  groupId: string;
  mortalityDate: string;
  mortalityAge: string;
  cause: FatteningMortalityCause;
  femaleCount: string;
  maleCount: string;
  totalWeight: string;
  note: string;
};

export const defaultFatteningMortalityRecords: FatteningMortalityRecord[] = [];

export function readStoredFatteningMortalityRecords() {
  if (typeof window === "undefined") return defaultFatteningMortalityRecords;
  try {
    const stored = window.localStorage.getItem(FATTENING_MORTALITY_RECORDS_STORAGE_KEY);
    if (!stored) return defaultFatteningMortalityRecords;
    const records = JSON.parse(stored) as FatteningMortalityRecord[];
    return Array.isArray(records) ? records : defaultFatteningMortalityRecords;
  } catch {
    return defaultFatteningMortalityRecords;
  }
}

export function storeFatteningMortalityRecords(records: FatteningMortalityRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FATTENING_MORTALITY_RECORDS_STORAGE_KEY, JSON.stringify(records));
}
