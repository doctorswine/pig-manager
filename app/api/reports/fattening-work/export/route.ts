import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

type WorkType = "전입" | "폐사" | "전출" | "출하";
type SortKey = "workDate" | "workType" | "detailType" | "groupId" | "age" | "totalCount";
type SortDirection = "asc" | "desc";
type ExportQuery = { fromDate?: string; toDate?: string; workType?: "all" | WorkType; detailType?: string; groupId?: string; primarySortKey?: SortKey; primarySortDirection?: SortDirection; secondarySortKey?: SortKey; secondarySortDirection?: SortDirection };
type ExportRecord = { workDate?: string; workType?: WorkType; detailType?: string; groupId?: string; age?: number; femaleCount?: number; maleCount?: number; totalCount?: number; partner?: string; liveWeight?: number | null; carcassWeight?: number | null; amount?: number | null; note?: string };
const sortLabels: Record<SortKey, string> = { workDate: "작업일", workType: "구분", detailType: "상세구분", groupId: "그룹ID", age: "일령", totalCount: "두수" };
function safeText(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function parseDate(value: unknown) { const text = String(value ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null; const date = new Date(`${text}T00:00:00`); return Number.isNaN(date.getTime()) ? null : date; }
function numberValue(value: unknown) { if (value === "" || value == null) return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function compare(left: ExportRecord, right: ExportRecord, key: SortKey) {
  if (key === "age" || key === "totalCount") return Number(left[key] || 0) - Number(right[key] || 0);
  return String(left[key] ?? "").localeCompare(String(right[key] ?? ""), "ko", { numeric: true });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { records?: ExportRecord[]; query?: ExportQuery; farmName?: string };
    if (!Array.isArray(payload.records)) return NextResponse.json({ message: "다운로드할 비육돈 작업 기록이 올바르지 않습니다." }, { status: 400 });
    const query = payload.query ?? {};
    const primarySortKey: SortKey = query.primarySortKey && query.primarySortKey in sortLabels ? query.primarySortKey : "workDate";
    const secondarySortKey: SortKey = query.secondarySortKey && query.secondarySortKey in sortLabels ? query.secondarySortKey : "groupId";
    const primaryDirection = query.primarySortDirection === "asc" ? 1 : -1;
    const secondaryDirection = query.secondarySortDirection === "desc" ? -1 : 1;
    const records = payload.records.slice(0, 10000).filter((record) => (!query.fromDate || String(record.workDate ?? "") >= query.fromDate) && (!query.toDate || String(record.workDate ?? "") <= query.toDate) && (!query.workType || query.workType === "all" || record.workType === query.workType) && (!query.detailType || query.detailType === "all" || record.detailType === query.detailType) && (!query.groupId || query.groupId === "all" || record.groupId === query.groupId)).sort((left, right) => compare(left, right, primarySortKey) * primaryDirection || compare(left, right, secondarySortKey) * secondaryDirection);

    const workbook = new ExcelJS.Workbook(); workbook.creator = "피그매니저"; workbook.created = new Date();
    const sheet = workbook.addWorksheet("비육돈작업대장", { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { defaultRowHeight: 20 } });
    sheet.mergeCells("A1:N1"); sheet.getCell("A1").value = "비육돈 작업대장"; sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } }; sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(1).height = 30;
    sheet.mergeCells("A2:N2"); sheet.getCell("A2").value = `농장명: ${safeText(payload.farmName || "참든팜")}    조회기간: ${query.fromDate || "전체"} ~ ${query.toDate || "전체"}    구분: ${query.workType === "all" || !query.workType ? "전체" : query.workType} / ${query.detailType === "all" || !query.detailType ? "전체" : query.detailType}    정렬: ${sortLabels[primarySortKey]} ${primaryDirection === 1 ? "오름차순" : "내림차순"}, ${sortLabels[secondarySortKey]} ${secondaryDirection === 1 ? "오름차순" : "내림차순"}`; sheet.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF52635D" } }; sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(2).height = 22;
    sheet.getRow(4).values = ["번호", "구분", "상세구분", "그룹ID", "작업일", "일령", "거래처/출처", "암", "수", "두수", "생체중(kg)", "지육체중(kg)", "금액(원)", "비고"]; sheet.getRow(4).height = 28;
    sheet.getRow(4).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146F5B" } }; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: "FF0F5549" } }, right: { style: "thin", color: { argb: "FFDCE5E1" } } }; });
    records.forEach((record, index) => {
      const row = sheet.addRow([index + 1, safeText(record.workType), safeText(record.detailType), safeText(record.groupId), parseDate(record.workDate), numberValue(record.age) ?? 0, safeText(record.partner), numberValue(record.femaleCount) ?? 0, numberValue(record.maleCount) ?? 0, numberValue(record.totalCount) ?? 0, numberValue(record.liveWeight), numberValue(record.carcassWeight), numberValue(record.amount), safeText(record.note)]);
      row.font = { name: "Arial", size: 10, color: { argb: "FF283A34" } }; row.alignment = { vertical: "middle" }; row.height = 21; row.eachCell((cell) => { cell.border = { bottom: { style: "hair", color: { argb: "FFDCE5E1" } } }; });
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" }; row.getCell(5).numFmt = "yyyy-mm-dd"; [6, 8, 9, 10].forEach((column) => { row.getCell(column).numFmt = "0"; }); [11, 12].forEach((column) => { row.getCell(column).numFmt = "#,##0.00"; }); row.getCell(13).numFmt = "#,##0";
    });
    sheet.columns = [{ width: 7 }, { width: 10 }, { width: 22 }, { width: 14 }, { width: 13 }, { width: 9 }, { width: 20 }, { width: 8 }, { width: 8 }, { width: 9 }, { width: 14 }, { width: 15 }, { width: 16 }, { width: 28 }];
    sheet.autoFilter = { from: "A4", to: `N${Math.max(4, records.length + 4)}` }; sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D"; sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("비육돈작업대장.xlsx")}`, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("비육돈 작업대장 엑셀 생성 실패", error);
    return NextResponse.json({ message: "비육돈 작업대장 엑셀 파일을 만들지 못했습니다." }, { status: 500 });
  }
}
