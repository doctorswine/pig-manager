export const NURSING_PIGLET_RECORDS_STORAGE_KEY = "pig-manager:nursing-piglet-records";

export type NursingPigletCategory = "포유자돈폐사" | "부분이유" | "양자전입" | "양자전출";

export type NursingPigletRecord = {
  id: number;
  animalNo: string;
  earTag: string;
  parity: string;
  farrowingDate: string;
  workDate: string;
  pigletAge: string;
  category: NursingPigletCategory;
  femaleCount: string;
  maleCount: string;
  cause: string;
  weight: string;
  note: string;
};

export const defaultNursingPigletRecords: NursingPigletRecord[] = [
  { id: 1, animalNo: "2871", earTag: "5317", parity: "2", farrowingDate: "2026-09-13", workDate: "2026-09-16", pigletAge: "3", category: "포유자돈폐사", femaleCount: "1", maleCount: "0", cause: "위축", weight: "", note: "" },
  { id: 2, animalNo: "2814", earTag: "4720", parity: "3", farrowingDate: "2026-09-12", workDate: "2026-09-15", pigletAge: "3", category: "양자전입", femaleCount: "1", maleCount: "0", cause: "산자수", weight: "", note: "포유두수 조정" },
  { id: 3, animalNo: "2942", earTag: "66123", parity: "1", farrowingDate: "2026-09-11", workDate: "2026-09-14", pigletAge: "3", category: "부분이유", femaleCount: "1", maleCount: "0", cause: "", weight: "2.1", note: "" },
];

export function readStoredNursingPigletRecords() {
  if (typeof window === "undefined") return defaultNursingPigletRecords;
  try {
    const stored = window.localStorage.getItem(NURSING_PIGLET_RECORDS_STORAGE_KEY);
    if (!stored) return defaultNursingPigletRecords;
    const records = JSON.parse(stored) as NursingPigletRecord[];
    return records.length ? records : defaultNursingPigletRecords;
  } catch {
    return defaultNursingPigletRecords;
  }
}
