import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

type SortKey = "farrowingDate" | "matingDate" | "animalNo" | "breed" | "parity" | "totalBorn" | "liveBorn" | "mummified" | "stillborn";
type SortDirection = "asc" | "desc";
type ExportQuery = { fromDate?: string; toDate?: string; primarySortKey?: SortKey; primarySortDirection?: SortDirection; secondarySortKey?: SortKey; secondarySortDirection?: SortDirection };
type ExportRecord = { id?: number; animalNo?: string; earTag?: string; breed?: string; parity?: string; matingDate?: string; farrowingDate?: string; farrowingType?: string; location?: string; totalBorn?: string; mummified?: string; stillborn?: string; liveFemale?: string; liveMale?: string; cullSmall?: string; cullDeformity?: string; cullOther?: string; nursingStart?: string; averageBirthWeight?: string; totalBirthWeight?: string; note?: string };

const sortLabels: Record<SortKey, string> = { farrowingDate: "분만일", matingDate: "교배일", animalNo: "모돈번호", breed: "품종", parity: "산차", totalBorn: "총산", liveBorn: "실산", mummified: "미라", stillborn: "사산" };
function safeText(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function parseDate(value: unknown) { const text = String(value ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null; const date = new Date(`${text}T00:00:00`); return Number.isNaN(date.getTime()) ? null : date; }
function numberValue(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function liveBorn(record: ExportRecord) { return numberValue(record.liveFemale) + numberValue(record.liveMale); }
function birthCull(record: ExportRecord) { return numberValue(record.cullSmall) + numberValue(record.cullDeformity) + numberValue(record.cullOther); }
function elapsedDays(fromDate: unknown, toDate: unknown) { const from = parseDate(fromDate); const to = parseDate(toDate); if (!from || !to) return null; const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000); return days >= 0 ? days : null; }
function compare(left: ExportRecord, right: ExportRecord, key: SortKey) {
  if (key === "liveBorn") return liveBorn(left) - liveBorn(right);
  if (["parity", "totalBorn", "mummified", "stillborn"].includes(key)) return numberValue(left[key as "parity" | "totalBorn" | "mummified" | "stillborn"]) - numberValue(right[key as "parity" | "totalBorn" | "mummified" | "stillborn"]);
  return String(left[key as keyof ExportRecord] ?? "").localeCompare(String(right[key as keyof ExportRecord] ?? ""), "ko", { numeric: true });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { records?: ExportRecord[]; query?: ExportQuery; farmName?: string };
    if (!Array.isArray(payload.records)) return NextResponse.json({ message: "다운로드할 분만 기록이 올바르지 않습니다." }, { status: 400 });
    const query = payload.query ?? {};
    const primarySortKey: SortKey = query.primarySortKey && query.primarySortKey in sortLabels ? query.primarySortKey : "farrowingDate";
    const secondarySortKey: SortKey = query.secondarySortKey && query.secondarySortKey in sortLabels ? query.secondarySortKey : "animalNo";
    const primaryDirection = query.primarySortDirection === "asc" ? 1 : -1;
    const secondaryDirection = query.secondarySortDirection === "desc" ? -1 : 1;
    const records = payload.records.slice(0, 5000)
      .filter((record) => (!query.fromDate || String(record.farrowingDate ?? "") >= query.fromDate) && (!query.toDate || String(record.farrowingDate ?? "") <= query.toDate))
      .sort((left, right) => compare(left, right, primarySortKey) * primaryDirection || compare(left, right, secondarySortKey) * secondaryDirection);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "피그매니저";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("분만대장", { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { defaultRowHeight: 20 } });
    sheet.mergeCells("A1:S1");
    sheet.getCell("A1").value = "분만대장";
    sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } };
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 30;
    sheet.mergeCells("A2:S2");
    sheet.getCell("A2").value = `농장명: ${safeText(payload.farmName || "참든팜")}    분만일: ${query.fromDate || "전체"} ~ ${query.toDate || "전체"}    정렬: ${sortLabels[primarySortKey]} ${primaryDirection === 1 ? "오름차순" : "내림차순"}, ${sortLabels[secondarySortKey]} ${secondaryDirection === 1 ? "오름차순" : "내림차순"}`;
    sheet.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF52635D" } };
    sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(2).height = 22;
    const headers = ["번호", "분만일", "모돈번호", "이각번호", "품종", "산차", "교배일", "임신일수", "분만구분", "총산", "실산", "미라", "사산", "생시도태", "포유개시", "평균생시체중(kg)", "총생시체중(kg)", "분만장소", "비고"];
    sheet.getRow(4).values = headers;
    sheet.getRow(4).height = 28;
    sheet.getRow(4).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146F5B" } }; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: "FF0F5549" } }, right: { style: "thin", color: { argb: "FFDCE5E1" } } }; });
    records.forEach((record, index) => {
      const row = sheet.addRow([index + 1, parseDate(record.farrowingDate), safeText(record.animalNo), safeText(record.earTag), safeText(record.breed), numberValue(record.parity), parseDate(record.matingDate), elapsedDays(record.matingDate, record.farrowingDate), safeText(record.farrowingType), numberValue(record.totalBorn), liveBorn(record), numberValue(record.mummified), numberValue(record.stillborn), birthCull(record), numberValue(record.nursingStart), numberValue(record.averageBirthWeight), numberValue(record.totalBirthWeight), safeText(record.location), safeText(record.note)]);
      row.font = { name: "Arial", size: 10, color: { argb: "FF283A34" } };
      row.alignment = { vertical: "middle" };
      row.height = 21;
      row.eachCell((cell) => { cell.border = { bottom: { style: "hair", color: { argb: "FFDCE5E1" } } }; });
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(2).numFmt = "yyyy-mm-dd";
      row.getCell(6).numFmt = "0";
      row.getCell(7).numFmt = "yyyy-mm-dd";
      row.getCell(8).numFmt = "0\"일\"";
      [10, 11, 12, 13, 14, 15].forEach((column) => { row.getCell(column).numFmt = "0"; });
      [16, 17].forEach((column) => { row.getCell(column).numFmt = "0.00"; });
    });
    sheet.columns = [{ width: 7 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 9 }, { width: 8 }, { width: 13 }, { width: 10 }, { width: 12 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 11 }, { width: 11 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 24 }];
    sheet.autoFilter = { from: "A4", to: `S${Math.max(4, records.length + 4)}` };
    sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D";
    sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("분만대장.xlsx")}`, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("분만대장 엑셀 생성 실패", error);
    return NextResponse.json({ message: "분만대장 엑셀 파일을 만들지 못했습니다." }, { status: 500 });
  }
}