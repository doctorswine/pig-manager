import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

type ExportRow = { key?: string; group?: string; label?: string; kind?: "count" | "average" | "rate"; digits?: number; values?: Array<number | null>; total?: number | null; average?: number | null; ratio?: number | null };
type ExportPeriod = { label?: string };

function safeText(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function numberOrBlank(value: unknown, blankZero: boolean) { return typeof value === "number" && Number.isFinite(value) && !(blankZero && value === 0) ? value : null; }
function columnLetter(index: number) { let n = index; let text = ""; while (n > 0) { const m = (n - 1) % 26; text = String.fromCharCode(65 + m) + text; n = Math.floor((n - 1) / 26); } return text; }

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { reportType?: string; periods?: ExportPeriod[]; rows?: ExportRow[]; start?: string; end?: string; farmName?: string };
    if (!Array.isArray(payload.periods) || !Array.isArray(payload.rows)) return NextResponse.json({ message: "다운로드할 교배실적이 올바르지 않습니다." }, { status: 400 });
    const isDaily = payload.reportType !== "series";
    const periods = payload.periods.slice(0, 60);
    const rows = payload.rows.slice(0, 60);
    const extra = isDaily ? ["합계", "평균", "비율(%)"] : ["목표"];
    const columnCount = 2 + periods.length + extra.length;
    const last = columnLetter(columnCount);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "피그매니저"; workbook.created = new Date();
    const sheet = workbook.addWorksheet("교배실적", { views: [{ state: "frozen", xSplit: 2, ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { defaultRowHeight: 18 } });
    sheet.mergeCells(`A1:${last}1`); sheet.getCell("A1").value = "교 배 실 적"; sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } }; sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(1).height = 30;
    sheet.mergeCells(`A2:${last}2`); sheet.getCell("A2").value = `농장명: ${safeText(payload.farmName || "참든팜")}    ${isDaily ? "일자별 교배실적" : "시계열 교배실적"}    조회기간: ${safeText(payload.start)} ~ ${safeText(payload.end)}`; sheet.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF52635D" } }; sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

    const thin = { style: "thin" as const, color: { argb: "FF9AA9A3" } };
    const border = { top: thin, bottom: thin, left: thin, right: thin };
    const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF146F5B" } };
    const labelFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEEF4F1" } };

    const head = sheet.getRow(4);
    head.values = ["구분", "", ...periods.map((period) => safeText(period.label)), ...extra]; head.height = 22;
    sheet.mergeCells("A4:B4");
    for (let column = 1; column <= columnCount; column += 1) { const cell = head.getCell(column); cell.fill = headerFill; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = border; }

    rows.forEach((row, index) => {
      const rowNumber = 5 + index; const line = sheet.getRow(rowNumber);
      const blankZero = row.kind === "count";
      line.values = [safeText(row.group || row.label), safeText(row.label), ...(row.values ?? []).slice(0, periods.length).map((value) => numberOrBlank(value, blankZero)), ...(isDaily ? [numberOrBlank(row.total, blankZero), numberOrBlank(row.average, blankZero), numberOrBlank(row.ratio, false)] : [null])];
      const format = row.kind === "count" ? "#,##0" : row.digits === 0 ? "#,##0" : "#,##0.0";
      for (let column = 1; column <= columnCount; column += 1) {
        const cell = line.getCell(column); cell.border = border; cell.font = { name: "Arial", size: 10, bold: row.key === "total" || row.key === "returnWithin7", color: { argb: "FF283A34" } };
        if (column <= 2) { cell.fill = labelFill; cell.alignment = { horizontal: "center", vertical: "middle" }; cell.font = { ...cell.font, bold: true }; }
        else { cell.alignment = { horizontal: "right", vertical: "middle" }; cell.numFmt = format; }
      }
      if (isDaily) { line.getCell(columnCount - 1).numFmt = row.kind === "count" ? "#,##0.0" : format; line.getCell(columnCount).numFmt = "0.0"; }
      if (!row.group) sheet.mergeCells(`A${rowNumber}:B${rowNumber}`);
    });
    // 같은 구분은 첫 열을 세로로 합친다.
    let start = 0;
    for (let index = 1; index <= rows.length; index += 1) {
      const group = rows[start]?.group;
      if (index === rows.length || rows[index]?.group !== group) {
        if (group && index - start > 1) { sheet.mergeCells(`A${5 + start}:A${5 + index - 1}`); sheet.getCell(`A${5 + start}`).alignment = { horizontal: "center", vertical: "middle", wrapText: true }; }
        start = index;
      }
    }
    sheet.columns = [{ width: 11 }, { width: 17 }, ...periods.map(() => ({ width: isDaily ? 9 : 20 })), ...extra.map(() => ({ width: 10 }))];
    sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D"; sheet.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("교배실적.xlsx")}`, "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "엑셀 파일 생성 중 오류가 발생했습니다." }, { status: 500 }); }
}
