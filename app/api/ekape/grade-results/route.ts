import { NextRequest, NextResponse } from "next/server";

const DEFAULT_GRADE_API_URL = "http://data.ekape.or.kr/openapi-data/service/user/grade/confirm/pig";
const DEFAULT_ISSUE_API_URL = "http://data.ekape.or.kr/openapi-data/service/user/grade/confirm/issueNo";
const MAX_AUTOMATIC_SEQUENCE_LOOKUPS = 120;
const FORWARD_EMPTY_LIMIT = 16;
const FARM_SEQUENCE_HINTS: Record<string, number> = { "500992": 1708 };

type GradeRecord = {
  id: string; gradeDate: string; issueDate: string; sex: string; slaughterhouseCode: string; slaughterhouseName: string;
  slaughterhouseAddress: string; slaughterNo: string; backfat: string; finalGrade: string; carcassWeight: string;
  auctionPrice: string; pigTraceNo: string; confirmationNo: string; skinType: string;
};

type IssueReference = { animalNo: string; issueNo: string; issueDate: string };

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
}

function readTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function normalizeApiKey(apiKey: string) {
  if (!apiKey.includes("%")) return apiKey;
  try { return decodeURIComponent(apiKey); } catch { return apiKey; }
}

function normalizeDate(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : value;
}

function responseError(xml: string) {
  const authenticationError = readTag(xml, "returnAuthMsg") || readTag(xml, "errMsg");
  if (authenticationError) return authenticationError;
  const resultCode = readTag(xml, "resultCode");
  const resultMessage = readTag(xml, "resultMsg");
  return resultCode && resultCode !== "00" ? (resultMessage || `축산물품질평가원 오류(${resultCode})`) : "";
}

async function fetchXml(baseUrl: string, apiKey: string, parameters: Record<string, string>) {
  const url = new URL(baseUrl);
  Object.entries(parameters).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); });
  url.searchParams.set(process.env.EKAPE_GRADE_KEY_PARAM || "ServiceKey", normalizeApiKey(apiKey));
  const response = await fetch(url, { headers: { Accept: "application/xml, text/xml" }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`축산물품질평가원 연동 응답 오류(${response.status})입니다.`);
  return response.text();
}

function parseIssueReferences(xml: string): IssueReference[] {
  const error = responseError(xml);
  if (error) {
    if (/NODATA|데이터없|조회된 데이터가 없/i.test(error)) return [];
    throw new Error(error);
  }
  return Array.from(xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)).map((match) => ({
    animalNo: readTag(match[1], "animalNo"), issueNo: readTag(match[1], "issueNo"), issueDate: normalizeDate(readTag(match[1], "issueDate")),
  })).filter((item) => item.issueNo);
}

function parsePigGradeXml(xml: string): GradeRecord[] {
  const error = responseError(xml);
  if (error) throw new Error(error);
  return Array.from(xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)).map((match, index) => {
    const item = match[1]; const issueNo = readTag(item, "issueNo"); const pigTraceNo = readTag(item, "pigNo"); const slaughterNo = readTag(item, "abattNo2");
    return {
      id: [issueNo, pigTraceNo, slaughterNo, index].filter(Boolean).join("-"),
      gradeDate: normalizeDate(readTag(item, "judgeDate")), issueDate: normalizeDate(readTag(item, "issueDate")), sex: readTag(item, "judgeSexNm"),
      slaughterhouseCode: readTag(item, "abattCode"), slaughterhouseName: readTag(item, "mgrAbattNm"), slaughterhouseAddress: readTag(item, "abattAddr"),
      slaughterNo, backfat: readTag(item, "backfat"), finalGrade: readTag(item, "gradeNm"), carcassWeight: readTag(item, "abattWeight"),
      auctionPrice: readTag(item, "costAmt"), pigTraceNo, confirmationNo: issueNo, skinType: readTag(item, "skinNm"),
    };
  });
}

async function lookupFarmDateRange(request: NextRequest, gradeApiKey: string) {
  const farmId = request.nextUrl.searchParams.get("farmId")?.trim() ?? "";
  const fromDate = request.nextUrl.searchParams.get("fromDate")?.trim() ?? "";
  const toDate = request.nextUrl.searchParams.get("toDate")?.trim() ?? "";
  const suppliedHint = request.nextUrl.searchParams.get("sequenceHint")?.trim() ?? "";
  if (!/^\d{6}$/.test(farmId)) throw new Error("농장식별번호는 숫자 6자리로 입력해 주세요.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || fromDate > toDate) throw new Error("올바른 판정일 시작일과 종료일을 입력해 주세요.");
  const periodDays = Math.floor((Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000);
  if (periodDays > 366) throw new Error("판정일 조회기간은 최대 1년까지 선택할 수 있습니다.");
  const hint = /^\d{1,5}$/.test(suppliedHint) ? Number(suppliedHint) : FARM_SEQUENCE_HINTS[farmId];
  if (!Number.isInteger(hint)) throw new Error("이 농장의 자동조회 기준 순번이 없습니다. 관리자에게 최근 이력 순번 등록을 요청해 주세요.");

  const issueApiKey = process.env.EKAPE_ISSUE_API_KEY || gradeApiKey;
  const issueApiUrl = process.env.EKAPE_ISSUE_API_URL || DEFAULT_ISSUE_API_URL;
  const references: IssueReference[] = [];
  const scannedSequences = new Set<number>();
  const knownSequences = new Set<number>();

  async function scan(sequences: number[]) {
    const valid = sequences.filter((sequence) => sequence >= 0 && sequence <= 99999 && !scannedSequences.has(sequence));
    valid.forEach((sequence) => scannedSequences.add(sequence));
    const results = await Promise.all(valid.map(async (sequence) => {
      const animalNo = `1${farmId}${String(sequence).padStart(5, "0")}`;
      return { sequence, items: parseIssueReferences(await fetchXml(issueApiUrl, issueApiKey, { animalNo })) };
    }));
    results.forEach(({ sequence, items }) => {
      if (items.length) knownSequences.add(sequence);
      references.push(...items);
    });
    return results;
  }

  let forwardEmpty = 0;
  for (let cursor = hint; cursor <= 99999 && scannedSequences.size < MAX_AUTOMATIC_SEQUENCE_LOOKUPS; cursor += 8) {
    const results = await scan(Array.from({ length: 8 }, (_, index) => cursor + index));
    for (const result of results) forwardEmpty = result.items.length ? 0 : forwardEmpty + 1;
    if (forwardEmpty >= FORWARD_EMPTY_LIMIT) break;
  }

  const newestKnownDate = references.map((item) => item.issueDate).filter(Boolean).sort().at(-1) ?? "";
  if (!newestKnownDate || newestKnownDate >= fromDate) {
    for (let cursor = hint - 1; cursor >= 0 && scannedSequences.size < MAX_AUTOMATIC_SEQUENCE_LOOKUPS; cursor -= 8) {
      await scan(Array.from({ length: 8 }, (_, index) => cursor - index));
      const oldestKnownDate = references.map((item) => item.issueDate).filter(Boolean).sort()[0] ?? "";
      if (oldestKnownDate && oldestKnownDate < fromDate) break;
    }
  }

  const matchingReferences = references.filter((item) => !item.issueDate || (item.issueDate >= fromDate && item.issueDate <= toDate));
  const uniqueReferences = Array.from(new Map(matchingReferences.map((item) => [`${item.issueNo}|${item.issueDate}`, item])).values());
  const records: GradeRecord[] = [];
  const gradeApiUrl = process.env.EKAPE_GRADE_API_URL || DEFAULT_GRADE_API_URL;
  for (let index = 0; index < uniqueReferences.length; index += 5) {
    const chunk = uniqueReferences.slice(index, index + 5);
    const results = await Promise.all(chunk.map(async (item) => parsePigGradeXml(await fetchXml(gradeApiUrl, gradeApiKey, { issueNo: item.issueNo, issueDate: item.issueDate }))));
    results.forEach((items) => records.push(...items));
  }

  const requestedAnimals = new Set(references.map((item) => item.animalNo).filter(Boolean));
  const filtered = records.filter((record) => (!record.pigTraceNo || requestedAnimals.has(record.pigTraceNo)) && record.gradeDate >= fromDate && record.gradeDate <= toDate);
  const uniqueRecords = Array.from(new Map(filtered.map((record) => [record.id, record])).values());
  uniqueRecords.sort((left, right) => right.gradeDate.localeCompare(left.gradeDate) || left.slaughterNo.localeCompare(right.slaughterNo, "ko", { numeric: true }));
  return {
    records: uniqueRecords,
    scannedCount: scannedSequences.size,
    certificateCount: uniqueReferences.length,
    latestKnownSequence: knownSequences.size ? Math.max(...knownSequences) : hint,
  };
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.EKAPE_GRADE_API_KEY || process.env.EKAPE_MYDATA_API_KEY;
  if (!apiKey) return NextResponse.json({ code: "EKAPE_NOT_CONFIGURED", message: "서버의 EKAPE_GRADE_API_KEY에 공공데이터포털 일반 인증키를 설정해 주세요." }, { status: 503 });
  try {
    if (request.nextUrl.searchParams.has("farmId")) {
      const result = await lookupFarmDateRange(request, apiKey);
      return NextResponse.json({ ...result, syncedAt: new Date().toISOString() });
    }
    const issueNo = request.nextUrl.searchParams.get("issueNo")?.trim() ?? "";
    const issueDate = request.nextUrl.searchParams.get("issueDate")?.trim() ?? "";
    if (!/^[0-9A-Za-z-]{1,20}$/.test(issueNo)) return NextResponse.json({ message: "확인서 발급번호를 영문, 숫자, 하이픈 20자 이내로 입력해 주세요." }, { status: 400 });
    const xml = await fetchXml(process.env.EKAPE_GRADE_API_URL || DEFAULT_GRADE_API_URL, apiKey, { issueNo, issueDate });
    return NextResponse.json({ records: parsePigGradeXml(xml), syncedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "축산물품질평가원 응답을 처리하지 못했습니다.";
    const isValidation = /입력|판정일|조회기간|기준 순번/.test(message);
    const needsIssuePermission = /등록되지 않은 서비스키|SERVICE_ACCESS_DENIED|서비스 접근/i.test(message);
    return NextResponse.json({ code: needsIssuePermission ? "EKAPE_ISSUE_API_PERMISSION_REQUIRED" : undefined, message: needsIssuePermission ? "농장별 자동수집을 사용하려면 공공데이터포털에서 '축산물품질평가원_축산물등급판정확인서 발급정보' API를 추가 활용신청해 주세요." : message }, { status: isValidation ? 400 : 502 });
  }
}