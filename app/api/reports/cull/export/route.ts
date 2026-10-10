import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

type SortKey = "eventDate" | "parity" | "animalNo" | "earTag" | "type" | "cause" | "breed";
type SortDirection = "asc" | "desc";
type CullFilter = "all" | "도태" | "폐사" | "전출" | "판매";
type ExportQuery = { fromDate?: string; toDate?: string; cullType?: CullFilter; primarySortKey?: SortKey; primarySortDirection?: SortDirection; secondarySortKey?: SortKey; secondarySortDirection?: SortDirection };
type ExportRecord = { eventDate?: string; animalNo?: string; earTag?: string; breed?: string; parity?: string; type?: string; cause?: string; previousStatus?: string; weight?: string; buyer?: string; saleAmount?: string; note?: string };
const sortLabels: Record<SortKey, string> = { eventDate: "도폐사일", parity: "산차", animalNo: "모돈번호", earTag: "이각번호", type: "도폐사구분", cause: "도폐사원인", breed: "품종" };
function safeText(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function parseDate(value: unknown) { const text = String(value ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null; const date = new Date(`${text}T00:00:00`); return Number.isNaN(date.getTime()) ? null : date; }
function numberValue(value: unknown) { if (value === "" || value == null) return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function compare(left: ExportRecord, right: ExportRecord, key: SortKey) {
  if (key === "parity") return Number(left.parity || 0) - Number(right.parity || 0);
  return String(left[key] ?? "").localeCompare(String(right[key] ?? ""), "ko", { numeric: true });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { records?: ExportRecord[]; query?: ExportQuery; farmName?: string };
    if (!Array.isArray(payload.records)) return NextResponse.json({ message: "다운로드할 도폐사 기록이 올바르지 않습니다." }, { status: 400 });
    const query = payload.query ?? {};
    const primarySortKey: SortKey = query.primarySortKey && query.primarySortKey in sortLabels ? query.primarySortKey : "eventDate";
    const secondarySortKey: SortKey = query.secondarySortKey && query.secondarySortKey in sortLabels ? query.secondarySortKey : "animalNo";
    const primaryDirection = query.primarySortDirection === "asc" ? 1 : -1;
    const secondaryDirection = query.secondarySortDirection === "desc" ? -1 : 1;
    const cullType = query.cullType || "all";
    const records = payload.records.slice(0, 5000).filter((record) => (!query.fromDate || String(record.eventDate ?? "") >= query.fromDate) && (!query.toDate || String(record.eventDate ?? "") <= query.toDate) && (cullType === "all" || record.type === cullType)).sort((left, right) => compare(left, right, primarySortKey) * primaryDirection || compare(left, right, secondarySortKey) * secondaryDirection);

    const workbook = new ExcelJS.Workbook(); workbook.creator = "피그매니저"; workbook.created = new Date();
    const sheet = workbook.addWorksheet("도폐사대장", { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { defaultRowHeight: 20 } });
    sheet.mergeCells("A1:M1"); sheet.getCell("A1").value = "도폐사 대장"; sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } }; sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(1).height = 30;
    sheet.mergeCells("A2:M2"); sheet.getCell("A2").value = `농장명: ${safeText(payload.farmName || "참든팜")}    도폐사일: ${query.fromDate || "전체"} ~ ${query.toDate || "전체"}    구분: ${cullType === "all" ? "전체" : cullType}    정렬: ${sortLabels[primarySortKey]} ${primaryDirection === 1 ? "오름차순" : "내림차순"}, ${sortLabels[secondarySortKey]} ${secondaryDirection === 1 ? "오름차순" : "내림차순"}`; sheet.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF52635D" } }; sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(2).height = 22;
    sheet.getRow(4).values = ["번호", "도폐사일", "모돈번호", "이각번호", "품종", "산차", "도폐사 구분", "도폐사원인", "이전상태", "체중(kg)", "판매처/전출처", "판매금액(원)", "비고"]; sheet.getRow(4).height = 28;
    sheet.getRow(4).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146F5B" } }; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: "FF0F5549" } }, right: { style: "thin", color: { argb: "FFDCE5E1" } } }; });
    records.forEach((record, index) => {
      const row = sheet.addRow([index + 1, parseDate(record.eventDate), safeText(record.animalNo), safeText(record.earTag), safeText(record.breed), Number(record.parity || 0), safeText(record.type), safeText(record.cause), safeText(record.previousStatus), numberValue(record.weight), safeText(record.buyer), numberValue(record.saleAmount) ?? 0, safeText(record.note)]);
      row.font = { name: "Arial", size: 10, color: { argb: "FF283A34" } }; row.alignment = { vertical: "middle" }; row.height = 21; row.eachCell((cell) => { cell.border = { bottom: { style: "hair", color: { argb: "FFDCE5E1" } } }; });
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" }; row.getCell(2).numFmt = "yyyy-mm-dd"; row.getCell(6).numFmt = "0"; row.getCell(10).numFmt = "0.00"; row.getCell(12).numFmt = "#,##0";
    });
    sheet.columns = [{ width: 7 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 9 }, { width: 8 }, { width: 13 }, { width: 20 }, { width: 13 }, { width: 12 }, { width: 20 }, { width: 16 }, { width: 28 }];
    sheet.autoFilter = { from: "A4", to: `M${Math.max(4, records.length + 4)}` }; sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D"; sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("도폐사대장.xlsx")}`, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("도폐사 대장 엑셀 생성 실패", error);
    return NextResponse.json({ message: "도폐사 대장 엑셀 파일을 만들지 못했습니다." }, { status: 500 });
  }
}
