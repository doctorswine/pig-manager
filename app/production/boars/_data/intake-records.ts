export const BOAR_INTAKE_RECORDS_STORAGE_KEY = "pig-manager:boar-intake-records";

export type BoarIntakeRecord = {
  id: number;
  animalNo: string;
  earTag: string;
  electronicTag: string;
  breed: string;
  birthDate: string;
  intakeDate: string;
  boarType: string;
  source: string;
  serviceStartDate: string;
  bloodlineNo: string;
  pedigreeDegree: string;
  sireNo: string;
  sireBloodlineNo: string;
  damNo: string;
  damBloodlineNo: string;
  weight: string;
  pss: string;
  note: string;
};

export const defaultBoarIntakeRecords: BoarIntakeRecord[] = [];

export function readStoredBoarIntakeRecords() {
  if (typeof window === "undefined") return defaultBoarIntakeRecords;

  try {
    const stored = window.localStorage.getItem(BOAR_INTAKE_RECORDS_STORAGE_KEY);
    if (!stored) return defaultBoarIntakeRecords;
    const records = JSON.parse(stored) as BoarIntakeRecord[];
    return Array.isArray(records) ? records : defaultBoarIntakeRecords;
  } catch {
    return defaultBoarIntakeRecords;
  }
}
