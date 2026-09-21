export const INTAKE_RECORDS_STORAGE_KEY = "pig-manager:intake-records";

export type SowIntakeRecord = {
  id: number;
  animalNo: string;
  earTag: string;
  breed: string;
  birthDate: string;
  intakeDate: string;
  status: string;
  source: string;
  weight: string;
  parity: string;
  matingCount?: string;
  lastWorkDate?: string;
  note?: string;
};

export const defaultIntakeRecords: SowIntakeRecord[] = [
  { id: 1, animalNo: "2960", earTag: "7062", breed: "YL", birthDate: "2026-04-30", intakeDate: "2026-09-11", status: "후보돈", source: "한빛 종돈장", weight: "108", parity: "0" },
  { id: 2, animalNo: "2933", earTag: "6633", breed: "YL", birthDate: "2026-04-30", intakeDate: "2026-09-11", status: "후보돈", source: "한빛 종돈장", weight: "105", parity: "0" },
  { id: 3, animalNo: "2934", earTag: "6657", breed: "YL", birthDate: "2026-03-25", intakeDate: "2026-09-11", status: "후보돈", source: "한빛 종돈장", weight: "112", parity: "0" },
  { id: 4, animalNo: "2935", earTag: "6617", breed: "YL", birthDate: "2026-04-02", intakeDate: "2026-09-11", status: "후보돈", source: "한빛 종돈장", weight: "109", parity: "0" },
  { id: 5, animalNo: "2936", earTag: "66130", breed: "YL", birthDate: "2026-04-05", intakeDate: "2026-09-11", status: "후보돈", source: "새봄 종돈장", weight: "107", parity: "0" },
  { id: 6, animalNo: "2937", earTag: "6643", breed: "YL", birthDate: "2026-04-12", intakeDate: "2026-09-11", status: "후보돈", source: "새봄 종돈장", weight: "110", parity: "0" },
];

export function readStoredIntakeRecords() {
  if (typeof window === "undefined") return defaultIntakeRecords;

  try {
    const stored = window.localStorage.getItem(INTAKE_RECORDS_STORAGE_KEY);
    if (!stored) return defaultIntakeRecords;
    const records = JSON.parse(stored) as SowIntakeRecord[];
    return records.length ? records : defaultIntakeRecords;
  } catch {
    return defaultIntakeRecords;
  }
}

