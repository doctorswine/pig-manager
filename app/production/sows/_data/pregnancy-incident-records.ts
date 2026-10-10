export const PREGNANCY_INCIDENT_RECORDS_STORAGE_KEY = "pig-manager:pregnancy-incident-records";

export type PregnancyIncidentRecord = {
  id: number;
  animalNo: string;
  earTag: string;
  breed: string;
  parity: string;
  matingDate: string;
  incidentDate: string;
  cause: string;
  diagnosisLocation: string;
  note: string;
};

export const defaultPregnancyIncidentRecords: PregnancyIncidentRecord[] = [
  { id: 1, animalNo: "2871", earTag: "5317", breed: "YL", parity: "2", matingDate: "2026-08-26", incidentDate: "2026-09-16", cause: "재발", diagnosisLocation: "임신사 2동", note: "재교배 예정" },
  { id: 2, animalNo: "2814", earTag: "4720", breed: "YL", parity: "3", matingDate: "2026-08-20", incidentDate: "2026-09-14", cause: "불임", diagnosisLocation: "임신사 1동", note: "" },
  { id: 3, animalNo: "2762", earTag: "5104", breed: "F1", parity: "1", matingDate: "2026-07-27", incidentDate: "2026-09-15", cause: "유산", diagnosisLocation: "임신사 1동", note: "상태 관찰" },
];

export function readStoredPregnancyIncidentRecords() {
  if (typeof window === "undefined") return defaultPregnancyIncidentRecords;
  try {
    const stored = window.localStorage.getItem(PREGNANCY_INCIDENT_RECORDS_STORAGE_KEY);
    if (!stored) return defaultPregnancyIncidentRecords;
    const records = JSON.parse(stored) as PregnancyIncidentRecord[];
    return Array.isArray(records) ? records : defaultPregnancyIncidentRecords;
  } catch {
    return defaultPregnancyIncidentRecords;
  }
}

export function writeStoredPregnancyIncidentRecords(records: PregnancyIncidentRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREGNANCY_INCIDENT_RECORDS_STORAGE_KEY, JSON.stringify(records));
}