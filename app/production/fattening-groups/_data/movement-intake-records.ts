export const MOVEMENT_INTAKE_RECORDS_STORAGE_KEY = "pig-manager:fattening-movement-intake-records";

export const MOVEMENT_INTAKE_TYPES = ["이유입식", "자돈구입", "농장내이동", "위탁(계열)전입", "부분이유입식"] as const;
export type MovementIntakeType = (typeof MOVEMENT_INTAKE_TYPES)[number];

export type MovementIntakeRecord = {
  id: number;
  groupId: string;
  intakeDate: string;
  intakeAge: string;
  movementType: MovementIntakeType;
  femaleCount: string;
  maleCount: string;
  totalWeight: string;
  sourceGroupId: string;
  note: string;
};

export const defaultMovementIntakeRecords: MovementIntakeRecord[] = [];

export function readStoredMovementIntakeRecords() {
  if (typeof window === "undefined") return defaultMovementIntakeRecords;
  try {
    const stored = window.localStorage.getItem(MOVEMENT_INTAKE_RECORDS_STORAGE_KEY);
    if (!stored) return defaultMovementIntakeRecords;
    const records = JSON.parse(stored) as MovementIntakeRecord[];
    return Array.isArray(records) ? records : defaultMovementIntakeRecords;
  } catch {
    return defaultMovementIntakeRecords;
  }
}

export function storeMovementIntakeRecords(records: MovementIntakeRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MOVEMENT_INTAKE_RECORDS_STORAGE_KEY, JSON.stringify(records));
}
