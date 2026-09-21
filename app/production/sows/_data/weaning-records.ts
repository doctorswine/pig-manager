export const WEANING_RECORDS_STORAGE_KEY = "pig-manager:weaning-records";

export type ReNursingChoice = "아니오" | "예";

export type WeaningRecord = {
  id: number;
  animalNo: string;
  earTag: string;
  parity: string;
  farrowingDate: string;
  weaningDate: string;
  weaningAge: string;
  femaleCount: string;
  maleCount: string;
  remainingFemale: string;
  remainingMale: string;
  averageWeight: string;
  totalWeight: string;
  reNursing: ReNursingChoice;
  reNursingFemale: string;
  reNursingMale: string;
  fosterInFemale: string;
  fosterInMale: string;
  fosterInSow: string;
  fosterOutFemale: string;
  fosterOutMale: string;
  fosterOutSow: string;
  sowMoveLocation: string;
  pigletMoveDestination: string;
  note: string;
};

export const defaultWeaningRecords: WeaningRecord[] = [
  {
    id: 1,
    animalNo: "2942",
    earTag: "66123",
    parity: "1",
    farrowingDate: "2026-09-11",
    weaningDate: "2026-09-18",
    weaningAge: "7",
    femaleCount: "10",
    maleCount: "0",
    remainingFemale: "0",
    remainingMale: "0",
    averageWeight: "2.35",
    totalWeight: "23.5",
    reNursing: "아니오",
    reNursingFemale: "0",
    reNursingMale: "0",
    fosterInFemale: "0",
    fosterInMale: "0",
    fosterInSow: "",
    fosterOutFemale: "0",
    fosterOutMale: "0",
    fosterOutSow: "",
    sowMoveLocation: "임신사 1동",
    pigletMoveDestination: "이유자돈사 A군",
    note: "예시 이유 기록",
  },
];

export function readStoredWeaningRecords() {
  if (typeof window === "undefined") return defaultWeaningRecords;
  try {
    const stored = window.localStorage.getItem(WEANING_RECORDS_STORAGE_KEY);
    if (!stored) return defaultWeaningRecords;
    const records = JSON.parse(stored) as WeaningRecord[];
    return records.length ? records : defaultWeaningRecords;
  } catch {
    return defaultWeaningRecords;
  }
}
