export const CULL_RECORDS_STORAGE_KEY = "pig-manager:cull-records";

export const CULL_TYPES = ["도태", "폐사", "전출", "판매"] as const;
export const CULL_CAUSES = ["고령/노산", "번식장애", "지제이상/기립불능", "산자수 저하", "포유성적 저하", "기타"] as const;

export type CullType = (typeof CULL_TYPES)[number];
export type CullCause = (typeof CULL_CAUSES)[number];

export type SowCullRecord = {
  id: number;
  animalNo: string;
  earTag: string;
  breed: string;
  parity: string;
  previousStatus: string;
  eventDate: string;
  type: CullType;
  cause: CullCause;
  weight: string;
  buyer: string;
  saleAmount: string;
  note: string;
};

export const defaultCullRecords: SowCullRecord[] = [
  { id: 1, animalNo: "2960", earTag: "7062", breed: "YL", parity: "0", previousStatus: "후보돈", eventDate: "2026-09-20", type: "도태", cause: "번식장애", weight: "118", buyer: "", saleAmount: "0", note: "" },
  { id: 2, animalNo: "2933", earTag: "6633", breed: "YL", parity: "0", previousStatus: "후보돈", eventDate: "2026-09-15", type: "판매", cause: "기타", weight: "120", buyer: "한빛농장", saleAmount: "350000", note: "후보돈 판매" },
  { id: 3, animalNo: "2934", earTag: "6657", breed: "YL", parity: "0", previousStatus: "후보돈", eventDate: "2026-09-08", type: "폐사", cause: "지제이상/기립불능", weight: "", buyer: "", saleAmount: "0", note: "" },
];

export function readStoredCullRecords() {
  if (typeof window === "undefined") return defaultCullRecords;
  try {
    const stored = window.localStorage.getItem(CULL_RECORDS_STORAGE_KEY);
    if (!stored) return defaultCullRecords;
    const records = JSON.parse(stored) as SowCullRecord[];
    return Array.isArray(records) ? records : defaultCullRecords;
  } catch {
    return defaultCullRecords;
  }
}

export function storeCullRecords(records: SowCullRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CULL_RECORDS_STORAGE_KEY, JSON.stringify(records));
}
