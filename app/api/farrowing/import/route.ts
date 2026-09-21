import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 1000;
const allowedBreeds = new Set(["F1", "YY", "LY", "F2", "YL", "LL", "DD", "기타"]);
const allowedTypes = new Set(["정상", "조산", "유도분만", "난산"]);
const requiredHeaders = ["모돈번호", "분만일", "분만구분", "총산"];
const knownHeaders = ["모돈번호", "이각번호", "품종", "산차", "교배일", "분만일", "분만구분", "분만장소", "총산", "미라", "사산", "실산(암)", "실산(수)", "생시도태-체미", "생시도태-기형", "생시도태-기타", "포유개시", "자돈평균체중(kg)", "자돈총체중(kg)", "비고"];
const inputHeaders = knownHeaders.filter((header) => !["실산(암)", "실산(수)", "포유개시"].includes(header));
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
    if (!headerRowNumber) return NextResponse.json({ message: "분만관리 양식의 필수 열을 찾지 못했습니다. ‘양식 다운로드’ 파일을 사용해 주세요." }, { status: 400 });

    const records = [];
    const errors: RowError[] = [];
    const seenKeys = new Set<string>();
    const get = (row: ExcelJS.Row, header: string) => { const column = headerMap.get(header); return column ? cellText(row.getCell(column)) : ""; };
    for (let rowNumber = headerRowNumber + 1; rowNumber <= Math.min(worksheet.rowCount, headerRowNumber + MAX_ROWS); rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      if (!inputHeaders.some((header) => String(get(row, header)).trim() !== "")) continue;
      const animalNo = String(get(row, "모돈번호")).trim();
      const earTag = String(get(row, "이각번호")).trim();
      const breedRaw = String(get(row, "품종")).replace(/^\d+\./, "").trim();
      const breed = breedRaw ? breedRaw.toUpperCase() : "";
      const parity = numberValue(get(row, "산차"), true);
      const matingDate = formatDate(get(row, "교배일"));
      const farrowingDate = formatDate(get(row, "분만일"));
      const farrowingType = String(get(row, "분만구분")).replace(/^\d+\./, "").trim();
      const totalBorn = numberValue(get(row, "총산"), true);
      const mummified = numberValue(get(row, "미라"), true);
      const stillborn = numberValue(get(row, "사산"), true);
      const enteredLiveFemale = numberValue(get(row, "실산(암)"), true);
      const enteredLiveMale = numberValue(get(row, "실산(수)"), true);
      const cullSmall = numberValue(get(row, "생시도태-체미"), true);
      const cullDeformity = numberValue(get(row, "생시도태-기형"), true);
      const cullOther = numberValue(get(row, "생시도태-기타"), true);
      const averageBirthWeight = numberValue(get(row, "자돈평균체중(kg)"));
      const totalBirthWeight = numberValue(get(row, "자돈총체중(kg)"));
      const rowMessages: string[] = [];
      if (!animalNo) rowMessages.push("모돈번호 누락");
      if (!farrowingDate) rowMessages.push("분만일 형식 오류");
      if (!allowedTypes.has(farrowingType)) rowMessages.push("분만구분 값 오류");
      if (breed && !allowedBreeds.has(breed)) rowMessages.push("품종 값 오류");
      if (parity === null) rowMessages.push("산차는 0 이상의 정수");
      if (matingDate === null) rowMessages.push("교배일 형식 오류");
      if (totalBorn === null || totalBorn === "") rowMessages.push("총산은 0 이상의 정수");
      if ([mummified, stillborn, enteredLiveFemale, enteredLiveMale, cullSmall, cullDeformity, cullOther].some((value) => value === null)) rowMessages.push("두수 항목은 0 이상의 정수");
      if (averageBirthWeight === null || totalBirthWeight === null) rowMessages.push("체중은 0 이상의 숫자");
      const total = Number(totalBorn || 0); const mummy = Number(mummified || 0); const still = Number(stillborn || 0);
      const expectedLiveBorn = Math.max(0, total - mummy - still);
      const liveFemale = enteredLiveFemale === "" ? expectedLiveBorn : Number(enteredLiveFemale);
      const liveMale = enteredLiveMale === "" ? 0 : Number(enteredLiveMale);
      const liveBorn = liveFemale + liveMale;
      const culls = Number(cullSmall || 0) + Number(cullDeformity || 0) + Number(cullOther || 0);
      if (mummy + still > total) rowMessages.push("미라와 사산 합계가 총산보다 큼");
      if (liveBorn !== expectedLiveBorn) rowMessages.push(`실산 암·수 합계는 ${expectedLiveBorn}두여야 함`);
      if (culls > liveBorn) rowMessages.push("생시도태 합계가 실산보다 큼");
      const key = `${animalNo}|${farrowingDate ?? ""}`;
      if (animalNo && farrowingDate && seenKeys.has(key)) rowMessages.push("파일 내 동일 모돈·분만일 중복");
      if (rowMessages.length) { errors.push({ row: rowNumber, message: rowMessages.join(", ") }); continue; }
      seenKeys.add(key);
      records.push({ animalNo, earTag, breed, parity: parity ?? "", matingDate: matingDate ?? "", farrowingDate: farrowingDate!, farrowingType, location: String(get(row, "분만장소")).trim(), totalBorn: totalBorn!, mummified: mummified || "0", stillborn: stillborn || "0", liveFemale: String(liveFemale), liveMale: String(liveMale), cullSmall: cullSmall || "0", cullDeformity: cullDeformity || "0", cullOther: cullOther || "0", nursingStart: String(Math.max(0, liveBorn - culls)), fosterInFemale: "0", fosterInMale: "0", fosterInSow: "", fosterOutFemale: "0", fosterOutMale: "0", fosterOutSow: "", averageBirthWeight: averageBirthWeight ?? "", totalBirthWeight: totalBirthWeight ?? "", note: String(get(row, "비고")).trim() });
    }
    if (worksheet.rowCount > headerRowNumber + MAX_ROWS) errors.push({ row: headerRowNumber + MAX_ROWS + 1, message: `한 번에 최대 ${MAX_ROWS}행까지 처리합니다.` });
    if (!records.length && !errors.length) return NextResponse.json({ message: "등록할 데이터가 없습니다. 양식의 7행부터 입력해 주세요." }, { status: 400 });
    return NextResponse.json({ records, errors, total: records.length + errors.length });
  } catch (error) {
    console.error("farrowing-import", error);
    return NextResponse.json({ message: "엑셀 파일을 읽지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요." }, { status: 400 });
  }
}
