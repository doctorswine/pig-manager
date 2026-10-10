import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

type ReportType = "all" | "gilt" | "sow";
type SortKey = "matingDate" | "parity" | "returnDays" | "breed" | "animalNo" | "earTag";
type SortDirection = "asc" | "desc";
type ExportQuery = { reportType?: ReportType; fromDate?: string; toDate?: string; primarySortKey?: SortKey; primarySortDirection?: SortDirection; secondarySortKey?: SortKey; secondarySortDirection?: SortDirection };
type ExportRecord = { id?: number; animalNo?: string; earTag?: string; breed?: string; parity?: string; matingDate?: string; returnDays?: number | null; boar1?: string; method1?: string; boar2?: string; method2?: string; boar3?: string; method3?: string; worker?: string; location?: string; expectedFarrowingDate?: string; note?: string };

const reportLabels: Record<ReportType, string> = { all: "전체 교배대장", gilt: "후보돈 교배대장", sow: "경산돈 교배대장" };
const sortLabels: Record<SortKey, string> = { matingDate: "교배일", parity: "산차", returnDays: "재귀일(초교배일)", breed: "품종", animalNo: "모돈번호", earTag: "이각번호" };
function safeText(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function parseDate(value: unknown) { const text = String(value ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null; const date = new Date(`${text}T00:00:00`); return Number.isNaN(date.getTime()) ? null : date; }
function compare(left: ExportRecord, right: ExportRecord, key: SortKey) { if (key === "parity" || key === "returnDays") return Number(left[key] ?? Number.MAX_SAFE_INTEGER) - Number(right[key] ?? Number.MAX_SAFE_INTEGER); return String(left[key] ?? "").localeCompare(String(right[key] ?? ""), "ko", { numeric: true }); }

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { records?: ExportRecord[]; query?: ExportQuery; farmName?: string };
    if (!Array.isArray(payload.records)) return NextResponse.json({ message: "다운로드할 교배 기록이 올바르지 않습니다." }, { status: 400 });
    const query = payload.query ?? {};
    const reportType: ReportType = query.reportType && query.reportType in reportLabels ? query.reportType : "all";
    const primarySortKey: SortKey = query.primarySortKey && query.primarySortKey in sortLabels ? query.primarySortKey : "matingDate";
    const secondarySortKey: SortKey = query.secondarySortKey && query.secondarySortKey in sortLabels ? query.secondarySortKey : "animalNo";
    const primaryDirection = query.primarySortDirection === "desc" ? -1 : 1;
    const secondaryDirection = query.secondarySortDirection === "desc" ? -1 : 1;
    const records = payload.records.slice(0, 5000)
      .filter((record) => (!query.fromDate || String(record.matingDate ?? "") >= query.fromDate) && (!query.toDate || String(record.matingDate ?? "") <= query.toDate))
      .filter((record) => reportType === "all" || (reportType === "gilt" ? Number(record.parity || 0) <= 0 : Number(record.parity || 0) > 0))
      .sort((left, right) => compare(left, right, primarySortKey) * primaryDirection || compare(left, right, secondarySortKey) * secondaryDirection);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "피그매니저";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(reportLabels[reportType], { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { defaultRowHeight: 20 } });
    sheet.mergeCells("A1:M1");
    sheet.getCell("A1").value = reportLabels[reportType];
    sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } };
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 30;
    sheet.mergeCells("A2:M2");
    sheet.getCell("A2").value = `농장명: ${safeText(payload.farmName || "참든팜")}    교배일: ${query.fromDate || "전체"} ~ ${query.toDate || "전체"}    정렬: ${sortLabels[primarySortKey]} ${primaryDirection === 1 ? "오름차순" : "내림차순"}, ${sortLabels[secondarySortKey]} ${secondaryDirection === 1 ? "오름차순" : "내림차순"}`;
    sheet.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF52635D" } };
    sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(2).height = 22;
    const headers = ["번호", "교배일", "모돈번호", "이각번호", "품종", "산차", "재귀일(초교배일)", "1차 웅돈/방법", "2차 웅돈/방법", "3차 웅돈/방법", "교배자", "분만예정일", "비고"];
    sheet.getRow(4).values = headers;
    sheet.getRow(4).height = 24;
    sheet.getRow(4).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146F5B" } }; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: "FF0F5549" } }, right: { style: "thin", color: { argb: "FFDCE5E1" } } }; });
    records.forEach((record, index) => {
      const row = sheet.addRow([index + 1, parseDate(record.matingDate), safeText(record.animalNo), safeText(record.earTag), safeText(record.breed), Number(record.parity || 0), record.returnDays == null ? null : Number(record.returnDays), safeText([record.boar1, record.method1].filter(Boolean).join(" / ")), safeText([record.boar2, record.method2].filter(Boolean).join(" / ")), safeText([record.boar3, record.method3].filter(Boolean).join(" / ")), safeText(record.worker), parseDate(record.expectedFarrowingDate), safeText(record.note)]);
      row.font = { name: "Arial", size: 10, color: { argb: "FF283A34" } };
      row.alignment = { vertical: "middle" };
      row.height = 21;
      row.eachCell((cell) => { cell.border = { bottom: { style: "hair", color: { argb: "FFDCE5E1" } } }; });
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(2).numFmt = "yyyy-mm-dd";
      row.getCell(6).numFmt = "0";
      row.getCell(7).numFmt = "0\"일\"";
      row.getCell(12).numFmt = "yyyy-mm-dd";
    });
    sheet.columns = [{ width: 7 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 9 }, { width: 8 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 12 }, { width: 14 }, { width: 24 }];
    sheet.autoFilter = { from: "A4", to: `M${Math.max(4, records.length + 4)}` };
    sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D";
    sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${reportLabels[reportType]}.xlsx`)}`, "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "엑셀 파일 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}