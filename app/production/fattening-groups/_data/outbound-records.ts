export const FATTENING_OUTBOUND_RECORDS_STORAGE_KEY = "pig-manager:fattening-outbound-records";

export const TRANSFER_TYPES = [
  "위탁(계열)전출",
  "농장내이동(자돈사)",
  "농장내이동(육성사)",
  "농장내이동(비육사)",
  "농장내이동(검정사)",
] as const;

export const SHIPMENT_TYPES = ["자돈판매", "비육출하", "도태출하", "종돈판매", "기타"] as const;

export type OutboundCategory = "전출" | "출하";
export type OutboundMovementType = (typeof TRANSFER_TYPES)[number] | (typeof SHIPMENT_TYPES)[number];

export type FatteningOutboundRecord = {
  id: number;
  groupId: string;
  actionDate: string;
  actionAge: string;
  category: OutboundCategory;
  movementType: OutboundMovementType;
  femaleCount: string;
  maleCount: string;
  liveWeight: string;
  carcassWeight: string;
  amount: string;
  partner: string;
  note: string;
};

export const defaultFatteningOutboundRecords: FatteningOutboundRecord[] = [];

export function readStoredFatteningOutboundRecords() {
  if (typeof window === "undefined") return defaultFatteningOutboundRecords;
  try {
    const stored = window.localStorage.getItem(FATTENING_OUTBOUND_RECORDS_STORAGE_KEY);
    if (!stored) return defaultFatteningOutboundRecords;
    const records = JSON.parse(stored) as FatteningOutboundRecord[];
    return Array.isArray(records) ? records : defaultFatteningOutboundRecords;
  } catch {
    return defaultFatteningOutboundRecords;
  }
}

export function storeFatteningOutboundRecords(records: FatteningOutboundRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FATTENING_OUTBOUND_RECORDS_STORAGE_KEY, JSON.stringify(records));
}
