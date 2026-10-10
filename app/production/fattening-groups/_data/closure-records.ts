export const FATTENING_GROUP_CLOSURE_RECORDS_STORAGE_KEY = "pig-manager:fattening-group-closure-records";

export type FatteningGroupClosureRecord = {
  id: number;
  groupId: string;
  closureDate: string;
  note: string;
};

export const defaultFatteningGroupClosureRecords: FatteningGroupClosureRecord[] = [];

export function readStoredFatteningGroupClosureRecords() {
  if (typeof window === "undefined") return defaultFatteningGroupClosureRecords;
  try {
    const stored = window.localStorage.getItem(FATTENING_GROUP_CLOSURE_RECORDS_STORAGE_KEY);
    if (!stored) return defaultFatteningGroupClosureRecords;
    const records = JSON.parse(stored) as FatteningGroupClosureRecord[];
    return Array.isArray(records) ? records : defaultFatteningGroupClosureRecords;
  } catch {
    return defaultFatteningGroupClosureRecords;
  }
}

export function storeFatteningGroupClosureRecords(records: FatteningGroupClosureRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FATTENING_GROUP_CLOSURE_RECORDS_STORAGE_KEY, JSON.stringify(records));
}
