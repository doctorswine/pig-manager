import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 1000;
const requiredHeaders = ["모돈번호", "이유일", "이유두수(암)", "이유두수(수)"];
const knownHeaders = [
  "모돈번호", "이각번호", "산차", "분만일", "이유일", "이유두수(암)", "이유두수(수)",
  "자돈평균체중(kg)", "자돈총체중(kg)", "재포유여부", "재포유두수(암)", "재포유두수(수)",
  "양자전입(암)", "양자전입(수)", "전출모돈", "양자전출(암)", "양자전출(수)", "전입모돈",
  "모돈이동장소", "자돈이동", "비고",
];

type RowError = { row: number; message: string };

function normalizeHeader(value: unknown) { return String(value ?? "").replace(/\s+/g, "").replace(/\*/g, "").trim(); }
function cellText(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (value instanceof Date) return value;
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return String(value.result ?? "").trim();
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
}
function formatDate(value: ReturnType<typeof cellText>) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const text = String(value).trim();
  const parts = text.match(/^(\d{4})(\d{2})(\d{2})$/) ?? text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (!parts) return null;
  const year = Number(parts[1]); const month = Number(parts[2]); const day = Number(parts[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function numberValue(value: ReturnType<typeof cellText>, integer = false) {
  if (value === "") return "";
  const number = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(number) || number < 0 || (integer && !Number.isInteger(number))) return null;
  return String(number);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ message: "업로드할 엑셀 파일을 선택해 주세요." }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ message: ".xlsx 형식의 파일만 업로드할 수 있습니다." }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ message: "파일 크기는 5MB 이하만 업로드할 수 있습니다." }, { status: 400 });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as never);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return NextResponse.json({ message: "첫 번째 시트를 찾을 수 없습니다." }, { status: 400 });

    let headerRowNumber = 0;
    let headerMap = new Map<string, number>();
    for (let rowNumber = 1; rowNumber <= Math.min(20, worksheet.rowCount); rowNumber += 1) {
      const candidate = new Map<string, number>();
      worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        const header = normalizeHeader(cellText(cell));
        if (knownHeaders.includes(header)) candidate.set(header, columnNumber);
      });
      if (requiredHeaders.every((header) => candidate.has(header))) { headerRowNumber = rowNumber; headerMap = candidate; break; }
    }
    if (!headerRowNumber) return NextResponse.json({ message: "이유관리 양식의 필수 열을 찾지 못했습니다. ‘양식 다운로드’ 파일을 사용해 주세요." }, { status: 400 });

    const records = [];
    const errors: RowError[] = [];
    const seenKeys = new Set<string>();
    const get = (row: ExcelJS.Row, header: string) => { const column = headerMap.get(header); return column ? cellText(row.getCell(column)) : ""; };
    for (let rowNumber = headerRowNumber + 1; rowNumber <= Math.min(worksheet.rowCount, headerRowNumber + MAX_ROWS); rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      if (!knownHeaders.some((header) => String(get(row, header)).trim() !== "")) continue;

      const animalNo = String(get(row, "모돈번호")).trim();
      const earTag = String(get(row, "이각번호")).trim();
      const parity = numberValue(get(row, "산차"), true);
      const farrowingDate = formatDate(get(row, "분만일"));
      const weaningDate = formatDate(get(row, "이유일"));
      const femaleCount = numberValue(get(row, "이유두수(암)"), true);
      const maleCount = numberValue(get(row, "이유두수(수)"), true);
      const averageWeight = numberValue(get(row, "자돈평균체중(kg)"));
      const totalWeight = numberValue(get(row, "자돈총체중(kg)"));
      const reNursingRaw = String(get(row, "재포유여부")).replace(/^\d+\./, "").trim();
      const reNursing = reNursingRaw || "아니오";
      const countHeaders = ["재포유두수(암)", "재포유두수(수)", "양자전입(암)", "양자전입(수)", "양자전출(암)", "양자전출(수)"] as const;
      const counts = Object.fromEntries(countHeaders.map((header) => [header, numberValue(get(row, header), true)]));
      const rowMessages: string[] = [];

      if (!animalNo) rowMessages.push("모돈번호 누락");
      if (!weaningDate) rowMessages.push("이유일 형식 오류");
      if (farrowingDate === null) rowMessages.push("분만일 형식 오류");
      if (parity === null) rowMessages.push("산차는 0 이상의 정수");
      if (femaleCount === null || maleCount === null || femaleCount === "" || maleCount === "") rowMessages.push("이유두수 암·수는 0 이상의 정수");
      if (averageWeight === null || totalWeight === null) rowMessages.push("체중은 0 이상의 숫자");
      if (Object.values(counts).some((value) => value === null)) rowMessages.push("두수 항목은 0 이상의 정수");
      if (!new Set(["아니오", "예"]).has(reNursing)) rowMessages.push("재포유여부는 아니오 또는 예");
      if (Number(femaleCount || 0) + Number(maleCount || 0) < 1) rowMessages.push("이유두수 합계는 1두 이상");
      if (farrowingDate && weaningDate && weaningDate < farrowingDate) rowMessages.push("이유일은 분만일 이후여야 함");
      const key = `${animalNo}|${weaningDate ?? ""}`;
      if (animalNo && weaningDate && seenKeys.has(key)) rowMessages.push("파일 내 동일 모돈·이유일 중복");
      if (rowMessages.length) { errors.push({ row: rowNumber, message: rowMessages.join(", ") }); continue; }

      seenKeys.add(key);
      records.push({
        animalNo, earTag, parity: parity ?? "", farrowingDate: farrowingDate ?? "", weaningDate: weaningDate!,
        femaleCount: femaleCount!, maleCount: maleCount!, averageWeight: averageWeight ?? "", totalWeight: totalWeight ?? "",
        reNursing, reNursingFemale: counts["재포유두수(암)"] || "0", reNursingMale: counts["재포유두수(수)"] || "0",
        fosterInFemale: counts["양자전입(암)"] || "0", fosterInMale: counts["양자전입(수)"] || "0", fosterInSow: String(get(row, "전출모돈")).trim(),
        fosterOutFemale: counts["양자전출(암)"] || "0", fosterOutMale: counts["양자전출(수)"] || "0", fosterOutSow: String(get(row, "전입모돈")).trim(),
        sowMoveLocation: String(get(row, "모돈이동장소")).trim(), pigletMoveDestination: String(get(row, "자돈이동")).trim(), note: String(get(row, "비고")).trim(),
      });
    }
    if (worksheet.rowCount > headerRowNumber + MAX_ROWS) errors.push({ row: headerRowNumber + MAX_ROWS + 1, message: `한 번에 최대 ${MAX_ROWS}행까지 처리합니다.` });
    if (!records.length && !errors.length) return NextResponse.json({ message: "등록할 데이터가 없습니다. 양식의 7행부터 입력해 주세요." }, { status: 400 });
    return NextResponse.json({ records, errors, total: records.length + errors.length });
  } catch (error) {
    console.error("weaning-import", error);
    return NextResponse.json({ message: "엑셀 파일을 읽지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요." }, { status: 400 });
  }
}
