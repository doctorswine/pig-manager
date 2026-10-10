import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

type Analysis = { groups?: string[]; causes?: string[]; counts?: Record<string, Record<string, number>>; causeTotals?: Record<string, number>; groupTotals?: Record<string, number>; total?: number; typeSummary?: Array<{ type?: string; count?: number }> };
type ExportQuery = { startDate?: string; endDate?: string; kind?: string; groupBy?: string };

const kindLabels: Record<string, string> = { all: "전체", "도태": "도태", "폐사": "폐사" };
const groupByLabels: Record<string, string> = { month: "월별", year: "연도별", parity: "산차별", breed: "품종별" };

function safeText(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function percent(value: number, total: number) { return total ? Math.round((value / total) * 1000) / 10 : 0; }
function columnLetter(index: number) { let n = index; let text = ""; while (n > 0) { const m = (n - 1) % 26; text = String.fromCharCode(65 + m) + text; n = Math.floor((n - 1) / 26); } return text; }

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { analysis?: Analysis; query?: ExportQuery; farmName?: string };
    const analysis = payload.analysis;
    if (!analysis || !Array.isArray(analysis.groups) || !Array.isArray(analysis.causes)) return NextResponse.json({ message: "다운로드할 도폐사 원인분석 결과가 올바르지 않습니다." }, { status: 400 });
    const query = payload.query ?? {};
    const groups = analysis.groups.slice(0, 240).map(safeText);
    const causes = analysis.causes.slice(0, 50).map(safeText);
    const total = num(analysis.total);
    const lastColumn = columnLetter(Math.max(4, groups.length + 3));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "피그매니저"; workbook.created = new Date();
    const sheet = workbook.addWorksheet("도폐사원인분석", { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { defaultRowHeight: 20 } });
    sheet.mergeCells(`A1:${lastColumn}1`); sheet.getCell("A1").value = "도폐사 원인 분석"; sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } }; sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(1).height = 30;
    sheet.mergeCells(`A2:${lastColumn}2`); sheet.getCell("A2").value = `농장명: ${safeText(payload.farmName || "참든팜")}    도폐사구분: ${kindLabels[query.kind || "all"] || "전체"}    항목: ${groupByLabels[query.groupBy || "month"] || "월별"}    조회기간: ${query.startDate || ""} ~ ${query.endDate || ""}`; sheet.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF52635D" } }; sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

    const thin = { style: "thin" as const, color: { argb: "FF9AA9A3" } };
    const border = { top: thin, bottom: thin, left: thin, right: thin };
    const header = (row: ExcelJS.Row, count: number) => { for (let column = 1; column <= count; column += 1) { const cell = row.getCell(column); cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146F5B" } }; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle" }; cell.border = border; } };
    const body = (row: ExcelJS.Row, count: number, bold = false) => { for (let column = 1; column <= count; column += 1) { const cell = row.getCell(column); cell.alignment = { horizontal: "center", vertical: "middle" }; cell.border = border; cell.font = { name: "Arial", size: 10, bold, color: { argb: "FF283A34" } }; if (bold) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF4F1" } }; } };

    // 1) 도폐사 구분 요약
    let rowNumber = 4;
    sheet.getRow(rowNumber).values = ["구분", "두수", "비율(%)"]; header(sheet.getRow(rowNumber), 3); rowNumber += 1;
    (analysis.typeSummary ?? []).slice(0, 10).forEach((item) => { const row = sheet.getRow(rowNumber); row.values = [safeText(item.type), num(item.count), percent(num(item.count), total)]; body(row, 3); row.getCell(3).numFmt = "0.0"; rowNumber += 1; });
    const summaryTotal = sheet.getRow(rowNumber); summaryTotal.values = ["합계", total, total ? 100 : 0]; body(summaryTotal, 3, true); rowNumber += 2;

    // 2) 원인 × 항목 표
    const columnCount = groups.length + 3;
    sheet.getRow(rowNumber).values = ["구분", ...groups, "합계", "비율(%)"]; header(sheet.getRow(rowNumber), columnCount); rowNumber += 1;
    (analysis.causes ?? []).slice(0, 50).forEach((cause, index) => {
      const counts = analysis.counts?.[cause] ?? {};
      const causeTotal = num(analysis.causeTotals?.[cause]);
      const row = sheet.getRow(rowNumber); row.values = [causes[index], ...(analysis.groups ?? []).slice(0, 240).map((group) => num(counts[group])), causeTotal, percent(causeTotal, total)]; body(row, columnCount); row.getCell(columnCount).numFmt = "0.0"; rowNumber += 1;
    });
    const totalRow = sheet.getRow(rowNumber); totalRow.values = ["합계", ...(analysis.groups ?? []).slice(0, 240).map((group) => num(analysis.groupTotals?.[group])), total, total ? 100 : 0]; body(totalRow, columnCount, true);

    sheet.columns = [{ width: 20 }, ...Array.from({ length: Math.max(2, groups.length + 2) }, () => ({ width: 11 }))];
    sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D"; sheet.pageSetup.margins = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("모돈도폐사원인분석.xlsx")}`, "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "엑셀 파일 생성 중 오류가 발생했습니다." }, { status: 500 }); }
}
