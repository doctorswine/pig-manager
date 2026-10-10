export const BOAR_CULL_RECORDS_STORAGE_KEY = "pig-manager:boar-cull-records";

export const BOAR_CULL_TYPES = ["도태", "폐사", "전출", "판매"] as const;
export const BOAR_CULL_CAUSES = ["고령/노산", "번식장애", "지제이상/기립불능", "산자수 저하", "포유성적 저하", "기타"] as const;

export type BoarCullType = (typeof BOAR_CULL_TYPES)[number];
export type BoarCullCause = (typeof BOAR_CULL_CAUSES)[number];

export type BoarCullRecord = {
  id: number;
  animalNo: string;
  earTag: string;
  breed: string;
  boarType: string;
  previousStatus: string;
  eventDate: string;
  type: BoarCullType;
  cause: BoarCullCause;
  weight: string;
  buyer: string;
  saleAmount: string;
  note: string;
};

export const defaultBoarCullRecords: BoarCullRecord[] = [];

export function readStoredBoarCullRecords() {
  if (typeof window === "undefined") return defaultBoarCullRecords;
  try {
    const stored = window.localStorage.getItem(BOAR_CULL_RECORDS_STORAGE_KEY);
    if (!stored) return defaultBoarCullRecords;
    const records = JSON.parse(stored) as BoarCullRecord[];
    return Array.isArray(records) ? records : defaultBoarCullRecords;
  } catch {
    return defaultBoarCullRecords;
  }
}

export function storeBoarCullRecords(records: BoarCullRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BOAR_CULL_RECORDS_STORAGE_KEY, JSON.stringify(records));
}
