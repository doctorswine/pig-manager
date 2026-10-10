import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

type SortKey = "incidentDate" | "matingDate" | "incidentDays" | "parity" | "cause" | "animalNo" | "earTag";
type SortDirection = "asc" | "desc";
type ExportQuery = { fromDate?: string; toDate?: string; primarySortKey?: SortKey; primarySortDirection?: SortDirection; secondarySortKey?: SortKey; secondarySortDirection?: SortDirection };
type ExportRecord = { id?: number; animalNo?: string; earTag?: string; breed?: string; parity?: string; matingDate?: string; incidentDate?: string; cause?: string; diagnosisLocation?: string; note?: string };

const sortLabels: Record<SortKey, string> = { incidentDate: "임신사고일", matingDate: "교배일", incidentDays: "사고일수", parity: "산차", cause: "임신사고원인", animalNo: "모돈번호", earTag: "이각번호" };
function safeText(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function parseDate(value: unknown) { const text = String(value ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null; const date = new Date(`${text}T00:00:00`); return Number.isNaN(date.getTime()) ? null : date; }
function elapsedDays(matingDate: unknown, incidentDate: unknown) { const start = parseDate(matingDate); const end = parseDate(incidentDate); if (!start || !end) return null; const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000); return days >= 0 ? days : null; }
function compare(left: ExportRecord, right: ExportRecord, key: SortKey) { if (key === "parity") return Number(left.parity || 0) - Number(right.parity || 0); if (key === "incidentDays") return Number(elapsedDays(left.matingDate, left.incidentDate) ?? Number.MAX_SAFE_INTEGER) - Number(elapsedDays(right.matingDate, right.incidentDate) ?? Number.MAX_SAFE_INTEGER); return String(left[key] ?? "").localeCompare(String(right[key] ?? ""), "ko", { numeric: true }); }

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { records?: ExportRecord[]; query?: ExportQuery; farmName?: string };
    if (!Array.isArray(payload.records)) return NextResponse.json({ message: "다운로드할 임신사고 기록이 올바르지 않습니다." }, { status: 400 });
    const query = payload.query ?? {};
    const primarySortKey: SortKey = query.primarySortKey && query.primarySortKey in sortLabels ? query.primarySortKey : "incidentDate";
    const secondarySortKey: SortKey = query.secondarySortKey && query.secondarySortKey in sortLabels ? query.secondarySortKey : "animalNo";
    const primaryDirection = query.primarySortDirection === "asc" ? 1 : -1;
    const secondaryDirection = query.secondarySortDirection === "desc" ? -1 : 1;
    const records = payload.records.slice(0, 5000)
      .filter((record) => (!query.fromDate || String(record.incidentDate ?? "") >= query.fromDate) && (!query.toDate || String(record.incidentDate ?? "") <= query.toDate))
      .sort((left, right) => compare(left, right, primarySortKey) * primaryDirection || compare(left, right, secondarySortKey) * secondaryDirection);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "피그매니저";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("임신진단 사고대장", { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { defaultRowHeight: 20 } });
    sheet.mergeCells("A1:K1");
    sheet.getCell("A1").value = "임신진단 사고대장";
    sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } };
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 30;
    sheet.mergeCells("A2:K2");
    sheet.getCell("A2").value = `농장명: ${safeText(payload.farmName || "참든팜")}    사고일: ${query.fromDate || "전체"} ~ ${query.toDate || "전체"}    정렬: ${sortLabels[primarySortKey]} ${primaryDirection === 1 ? "오름차순" : "내림차순"}, ${sortLabels[secondarySortKey]} ${secondaryDirection === 1 ? "오름차순" : "내림차순"}`;
    sheet.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF52635D" } };
    sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(2).height = 22;
    const headers = ["번호", "임신사고일", "모돈번호", "이각번호", "품종", "산차", "교배일", "사고일수", "임신사고원인", "진단 장소", "비고"];
    sheet.getRow(4).values = headers;
    sheet.getRow(4).height = 24;
    sheet.getRow(4).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146F5B" } }; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: "FF0F5549" } }, right: { style: "thin", color: { argb: "FFDCE5E1" } } }; });
    records.forEach((record, index) => {
      const row = sheet.addRow([index + 1, parseDate(record.incidentDate), safeText(record.animalNo), safeText(record.earTag), safeText(record.breed), Number(record.parity || 0), parseDate(record.matingDate), elapsedDays(record.matingDate, record.incidentDate), safeText(record.cause), safeText(record.diagnosisLocation), safeText(record.note)]);
      row.font = { name: "Arial", size: 10, color: { argb: "FF283A34" } };
      row.alignment = { vertical: "middle" };
      row.height = 21;
      row.eachCell((cell) => { cell.border = { bottom: { style: "hair", color: { argb: "FFDCE5E1" } } }; });
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(2).numFmt = "yyyy-mm-dd";
      row.getCell(6).numFmt = "0";
      row.getCell(7).numFmt = "yyyy-mm-dd";
      row.getCell(8).numFmt = "0\"일\"";
    });
    sheet.columns = [{ width: 7 }, { width: 14 }, { width: 13 }, { width: 13 }, { width: 9 }, { width: 8 }, { width: 14 }, { width: 11 }, { width: 16 }, { width: 18 }, { width: 25 }];
    sheet.autoFilter = { from: "A4", to: `K${Math.max(4, records.length + 4)}` };
    sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D";
    sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("임신진단 사고대장.xlsx")}`, "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "엑셀 파일 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}