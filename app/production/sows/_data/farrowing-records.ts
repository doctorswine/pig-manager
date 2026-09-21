export const FARROWING_RECORDS_STORAGE_KEY = "pig-manager:farrowing-records";

export type FarrowingRecord = {
  id: number;
  animalNo: string;
  earTag: string;
  breed: string;
  parity: string;
  matingDate: string;
  farrowingDate: string;
  farrowingType: string;
  location: string;
  totalBorn: string;
  mummified: string;
  stillborn: string;
  liveFemale: string;
  liveMale: string;
  cullSmall: string;
  cullDeformity: string;
  cullOther: string;
  nursingStart: string;
  fosterInFemale: string;
  fosterInMale: string;
  fosterInSow: string;
  fosterOutFemale: string;
  fosterOutMale: string;
  fosterOutSow: string;
  averageBirthWeight: string;
  totalBirthWeight: string;
  note: string;
};

export const defaultFarrowingRecords: FarrowingRecord[] = [
  { id: 1, animalNo: "2871", earTag: "5317", breed: "YL", parity: "2", matingDate: "2026-05-21", farrowingDate: "2026-09-13", farrowingType: "정상", location: "분만사 1동", totalBorn: "15", mummified: "0", stillborn: "1", liveFemale: "14", liveMale: "0", cullSmall: "1", cullDeformity: "0", cullOther: "0", nursingStart: "13", fosterInFemale: "0", fosterInMale: "0", fosterInSow: "", fosterOutFemale: "0", fosterOutMale: "0", fosterOutSow: "", averageBirthWeight: "1.35", totalBirthWeight: "18.9", note: "" },
  { id: 2, animalNo: "2814", earTag: "4720", breed: "YL", parity: "3", matingDate: "2026-05-20", farrowingDate: "2026-09-12", farrowingType: "유도분만", location: "분만사 1동", totalBorn: "14", mummified: "1", stillborn: "1", liveFemale: "12", liveMale: "0", cullSmall: "0", cullDeformity: "0", cullOther: "0", nursingStart: "12", fosterInFemale: "1", fosterInMale: "0", fosterInSow: "2871", fosterOutFemale: "0", fosterOutMale: "0", fosterOutSow: "", averageBirthWeight: "1.42", totalBirthWeight: "17.04", note: "상태 양호" },
  { id: 3, animalNo: "2942", earTag: "66123", breed: "F1", parity: "1", matingDate: "2026-05-18", farrowingDate: "2026-09-11", farrowingType: "정상", location: "분만사 2동", totalBorn: "13", mummified: "0", stillborn: "0", liveFemale: "13", liveMale: "0", cullSmall: "0", cullDeformity: "1", cullOther: "0", nursingStart: "12", fosterInFemale: "0", fosterInMale: "0", fosterInSow: "", fosterOutFemale: "1", fosterOutMale: "0", fosterOutSow: "2814", averageBirthWeight: "1.4", totalBirthWeight: "18.2", note: "" },
];

export function readStoredFarrowingRecords() {
  if (typeof window === "undefined") return defaultFarrowingRecords;
  try {
    const stored = window.localStorage.getItem(FARROWING_RECORDS_STORAGE_KEY);
    if (!stored) return defaultFarrowingRecords;
    const records = JSON.parse(stored) as FarrowingRecord[];
    return records.length ? records.map((record) => ({ ...record, fosterInFemale: record.fosterInFemale ?? "0", fosterInMale: record.fosterInMale ?? "0", fosterInSow: record.fosterInSow ?? "", fosterOutFemale: record.fosterOutFemale ?? "0", fosterOutMale: record.fosterOutMale ?? "0", fosterOutSow: record.fosterOutSow ?? "" })) : defaultFarrowingRecords;
  } catch {
    return defaultFarrowingRecords;
  }
}
