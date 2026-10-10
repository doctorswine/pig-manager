import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

type SortKey = "animalNo" | "breed" | "parity" | "birthDate" | "intakeDate" | "currentStatus" | "lastWorkDate";
type ExportRecord = { animalNo?: string; earTag?: string; breed?: string; parity?: string; birthDate?: string; intakeDate?: string; lastWorkDate?: string; lastWork?: string; currentStatus?: string; source?: string; currentLocation?: string };
type ExportQuery = { queryDate?: string; status?: string; location?: string; sortKey?: SortKey; sortDirection?: "asc" | "desc" };
const sortLabels: Record<SortKey, string> = { animalNo: "모돈번호", breed: "품종", parity: "산차", birthDate: "출생일", intakeDate: "전입일", currentStatus: "현재상태", lastWorkDate: "최종작업일" };

function safeText(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function parseDate(value: unknown) { const text = String(value ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null; const date = new Date(`${text}T00:00:00`); return Number.isNaN(date.getTime()) ? null : date; }

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { records?: ExportRecord[]; query?: ExportQuery; farmName?: string };
    if (!Array.isArray(payload.records)) return NextResponse.json({ message: "다운로드할 보유모돈 기록이 올바르지 않습니다." }, { status: 400 });
    const query = payload.query ?? {};
    const sortKey: SortKey = query.sortKey && query.sortKey in sortLabels ? query.sortKey : "animalNo";
    const records = payload.records.slice(0, 5000).sort((left, right) => {
      const compared = sortKey === "parity" ? Number(left.parity || 0) - Number(right.parity || 0) : String(left[sortKey] ?? "").localeCompare(String(right[sortKey] ?? ""), "ko", { numeric: true });
      return query.sortDirection === "desc" ? -compared : compared;
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "피그매니저"; workbook.created = new Date();
    const sheet = workbook.addWorksheet("보유모돈", { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { defaultRowHeight: 20 } });
    sheet.mergeCells("A1:L1"); sheet.getCell("A1").value = "보유모돈"; sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } }; sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(1).height = 30;
    sheet.mergeCells("A2:L2"); sheet.getCell("A2").value = `농장명: ${safeText(payload.farmName || "참든팜")}    조회일: ${query.queryDate || "전체"}    구분: ${query.status === "all" || !query.status ? "전체" : safeText(query.status)}    정렬: ${sortLabels[sortKey]} ${query.sortDirection === "desc" ? "내림차순" : "오름차순"}`; sheet.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF52635D" } }; sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(2).height = 22;
    const headers = ["번호", "모돈번호", "이각번호", "품종", "산차", "출생일", "전입일", "최종작업일", "최종작업", "현재상태", "구입처", "현재장소"];
    sheet.getRow(4).values = headers; sheet.getRow(4).height = 24; sheet.getRow(4).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146F5B" } }; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle" }; cell.border = { bottom: { style: "thin", color: { argb: "FF0F5549" } }, right: { style: "thin", color: { argb: "FFDCE5E1" } } }; });
    records.forEach((record, index) => {
      const row = sheet.addRow([index + 1, safeText(record.animalNo), safeText(record.earTag), safeText(record.breed), Number(record.parity || 0), parseDate(record.birthDate), parseDate(record.intakeDate), parseDate(record.lastWorkDate), safeText(record.lastWork), safeText(record.currentStatus), safeText(record.source), safeText(record.currentLocation)]);
      row.font = { name: "Arial", size: 10, color: { argb: "FF283A34" } }; row.alignment = { vertical: "middle" }; row.height = 21; row.eachCell((cell) => { cell.border = { bottom: { style: "hair", color: { argb: "FFDCE5E1" } } }; });
      [1, 4, 5, 9, 10].forEach((column) => { row.getCell(column).alignment = { horizontal: "center", vertical: "middle" }; });
      [6, 7, 8].forEach((column) => { row.getCell(column).numFmt = "yyyy-mm-dd"; });
    });
    sheet.columns = [{ width: 7 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 8 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 15 }, { width: 13 }, { width: 19 }, { width: 19 }];
    sheet.autoFilter = { from: "A4", to: `L${Math.max(4, records.length + 4)}` }; sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D"; sheet.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("보유모돈.xlsx")}`, "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "엑셀 파일 생성 중 오류가 발생했습니다." }, { status: 500 }); }
}
