import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

type Category = "포유자돈폐사" | "부분이유" | "양자전입" | "양자전출";
type ReportType = "all" | Category;
type SortKey = "workDate" | "farrowingDate" | "animalNo" | "earTag" | "parity" | "pigletAge" | "category" | "totalCount";
type SortDirection = "asc" | "desc";
type ExportQuery = { reportType?: ReportType; fromDate?: string; toDate?: string; primarySortKey?: SortKey; primarySortDirection?: SortDirection; secondarySortKey?: SortKey; secondarySortDirection?: SortDirection };
type ExportRecord = { id?: number; animalNo?: string; earTag?: string; parity?: string; farrowingDate?: string; workDate?: string; pigletAge?: string; category?: Category; femaleCount?: string; maleCount?: string; cause?: string; weight?: string; note?: string };

const reportLabels: Record<ReportType, string> = { all: "전체 포유자돈대장", 포유자돈폐사: "포유자돈 폐사대장", 부분이유: "부분이유대장", 양자전입: "양자전입대장", 양자전출: "양자전출대장" };
const sortLabels: Record<SortKey, string> = { workDate: "작업일", farrowingDate: "분만일", animalNo: "모돈번호", earTag: "이각번호", parity: "산차", pigletAge: "일령", category: "구분", totalCount: "두수" };
function safeText(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function parseDate(value: unknown) { const text = String(value ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null; const date = new Date(`${text}T00:00:00`); return Number.isNaN(date.getTime()) ? null : date; }
function numberValue(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function totalCount(record: ExportRecord) { return numberValue(record.femaleCount) + numberValue(record.maleCount); }
function compare(left: ExportRecord, right: ExportRecord, key: SortKey) {
  if (key === "totalCount") return totalCount(left) - totalCount(right);
  if (key === "parity" || key === "pigletAge") return numberValue(left[key]) - numberValue(right[key]);
  return String(left[key as keyof ExportRecord] ?? "").localeCompare(String(right[key as keyof ExportRecord] ?? ""), "ko", { numeric: true });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { records?: ExportRecord[]; query?: ExportQuery; farmName?: string };
    if (!Array.isArray(payload.records)) return NextResponse.json({ message: "다운로드할 포유자돈 기록이 올바르지 않습니다." }, { status: 400 });
    const query = payload.query ?? {};
    const reportType: ReportType = query.reportType && query.reportType in reportLabels ? query.reportType : "all";
    const primarySortKey: SortKey = query.primarySortKey && query.primarySortKey in sortLabels ? query.primarySortKey : "workDate";
    const secondarySortKey: SortKey = query.secondarySortKey && query.secondarySortKey in sortLabels ? query.secondarySortKey : "animalNo";
    const primaryDirection = query.primarySortDirection === "asc" ? 1 : -1;
    const secondaryDirection = query.secondarySortDirection === "desc" ? -1 : 1;
    const records = payload.records.slice(0, 5000)
      .filter((record) => (!query.fromDate || String(record.workDate ?? "") >= query.fromDate) && (!query.toDate || String(record.workDate ?? "") <= query.toDate))
      .filter((record) => reportType === "all" || record.category === reportType)
      .sort((left, right) => compare(left, right, primarySortKey) * primaryDirection || compare(left, right, secondarySortKey) * secondaryDirection);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "피그매니저";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("포유자돈대장", { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { defaultRowHeight: 20 } });
    sheet.mergeCells("A1:M1");
    sheet.getCell("A1").value = reportLabels[reportType];
    sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } };
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 30;
    sheet.mergeCells("A2:M2");
    sheet.getCell("A2").value = `농장명: ${safeText(payload.farmName || "참든팜")}    작업일: ${query.fromDate || "전체"} ~ ${query.toDate || "전체"}    정렬: ${sortLabels[primarySortKey]} ${primaryDirection === 1 ? "오름차순" : "내림차순"}, ${sortLabels[secondarySortKey]} ${secondaryDirection === 1 ? "오름차순" : "내림차순"}`;
    sheet.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF52635D" } };
    sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(2).height = 22;
    const headers = ["번호", "작업일", "모돈번호", "이각번호", "산차", "분만일", "일령", "구분", "암", "수", "합계", "원인/체중", "비고"];
    sheet.getRow(4).values = headers;
    sheet.getRow(4).height = 26;
    sheet.getRow(4).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146F5B" } }; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: "FF0F5549" } }, right: { style: "thin", color: { argb: "FFDCE5E1" } } }; });
    records.forEach((record, index) => {
      const causeWeight = [safeText(record.cause), record.weight ? `${numberValue(record.weight)}kg` : ""].filter(Boolean).join(" / ");
      const row = sheet.addRow([index + 1, parseDate(record.workDate), safeText(record.animalNo), safeText(record.earTag), numberValue(record.parity), parseDate(record.farrowingDate), numberValue(record.pigletAge), safeText(record.category), numberValue(record.femaleCount), numberValue(record.maleCount), totalCount(record), causeWeight, safeText(record.note)]);
      row.font = { name: "Arial", size: 10, color: { argb: "FF283A34" } };
      row.alignment = { vertical: "middle" };
      row.height = 21;
      row.eachCell((cell) => { cell.border = { bottom: { style: "hair", color: { argb: "FFDCE5E1" } } }; });
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(2).numFmt = "yyyy-mm-dd";
      row.getCell(5).numFmt = "0";
      row.getCell(6).numFmt = "yyyy-mm-dd";
      row.getCell(7).numFmt = "0\"일\"";
      [9, 10, 11].forEach((column) => { row.getCell(column).numFmt = "0"; });
    });
    sheet.columns = [{ width: 7 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 8 }, { width: 13 }, { width: 9 }, { width: 16 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 20 }, { width: 25 }];
    sheet.autoFilter = { from: "A4", to: `M${Math.max(4, records.length + 4)}` };
    sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D";
    sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("포유자돈대장.xlsx")}`, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("포유자돈대장 엑셀 생성 실패", error);
    return NextResponse.json({ message: "포유자돈대장 엑셀 파일을 만들지 못했습니다." }, { status: 500 });
  }
}