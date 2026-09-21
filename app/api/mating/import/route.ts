import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 1000;
const allowedBreeds = new Set(["F1", "YY", "LY", "F2", "YL", "LL", "DD", "기타"]);
const allowedMethods = new Set(["인공", "자연"]);
const requiredHeaders = ["모돈번호", "교배일"];
const knownHeaders = [
  "모돈번호", "이각번호", "품종", "산차", "교배일", "웅돈1번호", "웅돈1방법",
  "웅돈2번호", "웅돈2방법", "웅돈3번호", "웅돈3방법", "등지방(mm)", "교배자", "장소", "비고",
];

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
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
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

function normalizeMethod(value: ReturnType<typeof cellText>, hasBoar: boolean) {
  const method = String(value).replace(/^\d+\./, "").trim();
  return method || (hasBoar ? "인공" : "인공");
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
      if (requiredHeaders.every((header) => candidate.has(header))) {
        headerRowNumber = rowNumber;
        headerMap = candidate;
        break;
      }
    }
    if (!headerRowNumber) return NextResponse.json({ message: "교배관리 양식의 필수 열을 찾지 못했습니다. ‘양식 다운로드’ 파일을 사용해 주세요." }, { status: 400 });

    const records = [];
    const errors: RowError[] = [];
    const seenKeys = new Set<string>();
    const get = (row: ExcelJS.Row, header: string) => {
      const column = headerMap.get(header);
      return column ? cellText(row.getCell(column)) : "";
    };

    const lastRow = Math.min(worksheet.rowCount, headerRowNumber + MAX_ROWS);
    for (let rowNumber = headerRowNumber + 1; rowNumber <= lastRow; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const hasAnyValue = knownHeaders.some((header) => String(get(row, header)).trim() !== "");
      if (!hasAnyValue) continue;

      const animalNo = String(get(row, "모돈번호")).trim();
      const earTag = String(get(row, "이각번호")).trim();
      const breedRaw = String(get(row, "품종")).replace(/^\d+\./, "").trim();
      const breed = breedRaw ? breedRaw.toUpperCase() : "";
      const matingDate = formatDate(get(row, "교배일"));
      const parity = parseNonNegativeNumber(get(row, "산차"), true);
      const backfat = parseNonNegativeNumber(get(row, "등지방(mm)"));
      const boar1 = String(get(row, "웅돈1번호")).trim();
      const boar2 = String(get(row, "웅돈2번호")).trim();
      const boar3 = String(get(row, "웅돈3번호")).trim();
      const method1 = normalizeMethod(get(row, "웅돈1방법"), Boolean(boar1));
      const method2 = normalizeMethod(get(row, "웅돈2방법"), Boolean(boar2));
      const method3 = normalizeMethod(get(row, "웅돈3방법"), Boolean(boar3));
      const rowMessages: string[] = [];

      if (!animalNo) rowMessages.push("모돈번호 누락");
      if (!matingDate) rowMessages.push("교배일 형식 오류");
      if (breed && !allowedBreeds.has(breed)) rowMessages.push("품종 값 오류");
      if (parity === null) rowMessages.push("산차는 0 이상의 정수");
      if (backfat === null) rowMessages.push("등지방은 0 이상의 숫자");
      if (!allowedMethods.has(method1) || !allowedMethods.has(method2) || !allowedMethods.has(method3)) rowMessages.push("교배방법은 인공 또는 자연");
      const duplicateKey = `${animalNo}|${matingDate ?? ""}`;
      if (animalNo && matingDate && seenKeys.has(duplicateKey)) rowMessages.push("파일 내 동일 모돈·교배일 중복");
      if (rowMessages.length) {
        errors.push({ row: rowNumber, message: rowMessages.join(", ") });
        continue;
      }

      seenKeys.add(duplicateKey);
      records.push({
        animalNo, earTag, breed, parity: parity ?? "", matingDate: matingDate!,
        boar1, method1, boar2, method2, boar3, method3, backfat: backfat ?? "",
        worker: String(get(row, "교배자")).trim(), location: String(get(row, "장소")).trim(), note: String(get(row, "비고")).trim(),
      });
    }

    if (worksheet.rowCount > headerRowNumber + MAX_ROWS) errors.push({ row: headerRowNumber + MAX_ROWS + 1, message: `한 번에 최대 ${MAX_ROWS}행까지 처리합니다.` });
    if (!records.length && !errors.length) return NextResponse.json({ message: "등록할 데이터가 없습니다. 양식의 7행부터 입력해 주세요." }, { status: 400 });
    return NextResponse.json({ records, errors, total: records.length + errors.length });
  } catch (error) {
    console.error("mating-import", error);
    return NextResponse.json({ message: "엑셀 파일을 읽지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요." }, { status: 400 });
  }
}
