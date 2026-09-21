export const MATING_RECORDS_STORAGE_KEY = "pig-manager:mating-records";

export type MatingRecord = {
  id: number;
  animalNo: string;
  earTag: string;
  breed: string;
  parity: string;
  matingDate: string;
  boar1: string;
  method1: string;
  boar2: string;
  method2: string;
  boar3: string;
  method3: string;
  backfat: string;
  worker: string;
  location: string;
  note: string;
};

export const defaultMatingRecords: MatingRecord[] = [
  { id: 1, animalNo: "2942", earTag: "66123", breed: "F1", parity: "0", matingDate: "2026-09-19", boar1: "D3405", method1: "인공", boar2: "", method2: "인공", boar3: "", method3: "인공", backfat: "14.2", worker: "김관리", location: "교배사 1동", note: "초교배" },
  { id: 2, animalNo: "2943", earTag: "66124", breed: "F1", parity: "0", matingDate: "2026-09-19", boar1: "D3405", method1: "인공", boar2: "", method2: "인공", boar3: "", method3: "인공", backfat: "13.8", worker: "김관리", location: "교배사 1동", note: "" },
  { id: 3, animalNo: "2871", earTag: "5317", breed: "YL", parity: "2", matingDate: "2026-09-18", boar1: "D121", method1: "인공", boar2: "D3405", method2: "인공", boar3: "", method3: "인공", backfat: "15.1", worker: "박현장", location: "교배사 2동", note: "재교배" },
  { id: 4, animalNo: "2814", earTag: "4720", breed: "YL", parity: "3", matingDate: "2026-09-17", boar1: "D121", method1: "인공", boar2: "", method2: "인공", boar3: "", method3: "인공", backfat: "16.0", worker: "박현장", location: "교배사 2동", note: "" },
];

export function readStoredMatingRecords() {
  if (typeof window === "undefined") return defaultMatingRecords;
  try {
    const stored = window.localStorage.getItem(MATING_RECORDS_STORAGE_KEY);
    if (!stored) return defaultMatingRecords;
    const records = JSON.parse(stored) as MatingRecord[];
    return records.length ? records : defaultMatingRecords;
  } catch {
    return defaultMatingRecords;
  }
}

