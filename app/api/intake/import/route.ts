import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 1000;
const allowedBreeds = new Set(["F1", "YY", "LY", "F2", "YL", "LL", "DD", "기타"]);
const allowedStatuses = new Set(["후보돈", "임신돈", "포유돈", "이유모돈", "사고돈", "대리모돈", "유산돈"]);

const requiredHeaders = ["모돈번호", "품종", "출생일", "전입일", "시작상태", "시작산차"];
const knownHeaders = [
  "모돈번호", "이각번호", "품종", "출생일", "전입일", "최종작업일",
  "구입처", "시작상태", "전입체중(kg)", "시작산차", "교배차수", "비고",
];

type ImportRecord = {
  animalNo: string;
  earTag: string;
  breed: string;
  birthDate: string;
  intakeDate: string;
  lastWorkDate: string;
  source: string;
  status: string;
  weight: string;
  parity: string;
  matingCount: string;
  note: string;
};

type RowError = { row: number; message: string };

function normalizeHeader(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").replace(/\*/g, "").trim();
}

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
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const text = String(value).trim();
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  const separated = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  const parts = compact ?? separated;
  if (!parts) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseNonNegativeNumber(value: ReturnType<typeof cellText>, integer = false) {
  if (value === "") return "";
  const number = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(number) || number < 0 || (integer && !Number.isInteger(number))) return null;
  return String(number);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "업로드할 엑셀 파일을 선택해 주세요." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ message: ".xlsx 형식의 파일만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: "파일 크기는 5MB 이하만 업로드할 수 있습니다." }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await workbook.xlsx.load(fileBuffer as never);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ message: "첫 번째 시트를 찾을 수 없습니다." }, { status: 400 });
    }

    let headerRowNumber = 0;
    let headerMap = new Map<string, number>();
    const searchLimit = Math.min(20, worksheet.rowCount);
    for (let rowNumber = 1; rowNumber <= searchLimit; rowNumber += 1) {
      const candidate = new Map<string, number>();
      worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        const header = normalizeHeader(cellText(cell));
        if (knownHeaders.includes(header)) candidate.set(header, columnNumber);
      });
      if (requiredHeaders.every((header) => candidate.has(header))) {
        headerRowNumber = rowNumber;
        headerMap = candidate;
        break;
      }
    }

    if (!headerRowNumber) {
      return NextResponse.json({ message: "전입관리 양식의 필수 열을 찾지 못했습니다. ‘양식 다운로드’ 파일을 사용해 주세요." }, { status: 400 });
    }

    const records: ImportRecord[] = [];
    const errors: RowError[] = [];
    const seenAnimalNos = new Set<string>();
    const get = (row: ExcelJS.Row, header: string) => {
      const column = headerMap.get(header);
      return column ? cellText(row.getCell(column)) : "";
    };

    const lastRow = Math.min(worksheet.rowCount, headerRowNumber + MAX_ROWS);
    for (let rowNumber = headerRowNumber + 1; rowNumber <= lastRow; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const animalNo = String(get(row, "모돈번호")).trim();
      const hasAnyValue = knownHeaders.some((header) => String(get(row, header)).trim() !== "");
      if (!hasAnyValue) continue;

      const rowMessages: string[] = [];
      const breed = String(get(row, "품종")).replace(/^\d+\./, "").trim().toUpperCase();
      const status = String(get(row, "시작상태")).replace(/^\d+\./, "").trim();
      const birthDate = formatDate(get(row, "출생일"));
      const intakeDate = formatDate(get(row, "전입일"));
      const lastWorkDate = formatDate(get(row, "최종작업일"));
      const weight = parseNonNegativeNumber(get(row, "전입체중(kg)"));
      const parity = parseNonNegativeNumber(get(row, "시작산차"), true);
      const matingCount = parseNonNegativeNumber(get(row, "교배차수"), true);

      if (!animalNo) rowMessages.push("모돈번호 누락");
      if (animalNo && seenAnimalNos.has(animalNo)) rowMessages.push("파일 내 모돈번호 중복");
      if (!allowedBreeds.has(breed)) rowMessages.push("품종 값 오류");
      if (!birthDate) rowMessages.push("출생일 형식 오류");
      if (!intakeDate) rowMessages.push("전입일 형식 오류");
      if (lastWorkDate === null) rowMessages.push("최종 작업일 형식 오류");
      if (!allowedStatuses.has(status)) rowMessages.push("시작상태 값 오류");
      if (weight === null) rowMessages.push("전입체중은 0 이상의 숫자");
      if (parity === null || parity === "") rowMessages.push("시작산차는 0 이상의 정수");
      if (matingCount === null) rowMessages.push("교배차수는 0 이상의 정수");

      if (rowMessages.length) {
        errors.push({ row: rowNumber, message: rowMessages.join(", ") });
        continue;
      }

      seenAnimalNos.add(animalNo);
      records.push({
        animalNo,
        earTag: String(get(row, "이각번호")).trim(),
        breed,
        birthDate: birthDate!,
        intakeDate: intakeDate!,
        lastWorkDate: lastWorkDate ?? "",
        source: String(get(row, "구입처")).trim(),
        status,
        weight: weight ?? "",
        parity: parity!,
        matingCount: matingCount ?? "",
        note: String(get(row, "비고")).trim(),
      });
    }

    if (worksheet.rowCount > headerRowNumber + MAX_ROWS) {
      errors.push({ row: headerRowNumber + MAX_ROWS + 1, message: `한 번에 최대 ${MAX_ROWS}행까지 처리합니다.` });
    }
    if (!records.length && !errors.length) {
      return NextResponse.json({ message: "등록할 데이터가 없습니다. 양식의 7행부터 입력해 주세요." }, { status: 400 });
    }

    return NextResponse.json({ records, errors, total: records.length + errors.length });
  } catch (error) {
    console.error("intake-import", error);
    return NextResponse.json({ message: "엑셀 파일을 읽지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요." }, { status: 400 });
  }
}
