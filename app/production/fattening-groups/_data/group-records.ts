export const FATTENING_GROUP_RECORDS_STORAGE_KEY = "pig-manager:fattening-group-records";

export type FatteningGroupRecord = {
  id: number;
  groupId: string;
  startDate: string;
  location: string;
  sex: string;
  breed: string;
  startAge: string;
  femaleCount: string;
  maleCount: string;
  note: string;
};

export const defaultFatteningGroupRecords: FatteningGroupRecord[] = [];

export function readStoredFatteningGroupRecords() {
  if (typeof window === "undefined") return defaultFatteningGroupRecords;
  try {
    const stored = window.localStorage.getItem(FATTENING_GROUP_RECORDS_STORAGE_KEY);
    if (!stored) return defaultFatteningGroupRecords;
    const records = JSON.parse(stored) as FatteningGroupRecord[];
    return Array.isArray(records) ? records : defaultFatteningGroupRecords;
  } catch {
    return defaultFatteningGroupRecords;
  }
}

export function storeFatteningGroupRecords(records: FatteningGroupRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FATTENING_GROUP_RECORDS_STORAGE_KEY, JSON.stringify(records));
}
