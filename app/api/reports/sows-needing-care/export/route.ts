import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

type ExportColumn = { key?: string; label?: string; type?: "date" | "number" | "text" };
type ExportRow = { animalNo?: string; breed?: string; values?: Record<string, string | number | null> };
type ExportSection = { key?: string; title?: string; criteria?: string; columns?: ExportColumn[]; rows?: ExportRow[] };
type ExportQuery = { baseDate?: string; sortKey1?: string; sortDirection1?: string; sortKey2?: string; sortDirection2?: string };

const sortLabels: Record<string, string> = { overdueDays: "초과일수", animalNo: "모돈번호", parity: "산차", breed: "품종" };

function safeText(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
// ExcelJS는 날짜를 UTC 기준 일련번호로 저장하므로 UTC 자정으로 만들어야 서버 시간대(한국 등)와 관계없이 같은 날짜로 표시된다.
function parseDate(value: unknown) { const text = String(value ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null; const date = new Date(`${text}T00:00:00Z`); return Number.isNaN(date.getTime()) ? null : date; }
function sortText(key?: string, direction?: string) { return key && sortLabels[key] ? `${sortLabels[key]} ${direction === "desc" ? "내림차순" : "오름차순"}` : ""; }
function columnLetter(index: number) { let n = index; let text = ""; while (n > 0) { const m = (n - 1) % 26; text = String.fromCharCode(65 + m) + text; n = Math.floor((n - 1) / 26); } return text; }

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { sections?: ExportSection[]; query?: ExportQuery; farmName?: string };
    if (!Array.isArray(payload.sections) || !payload.sections.length) return NextResponse.json({ message: "다운로드할 관리대상모돈 기록이 올바르지 않습니다." }, { status: 400 });
    const query = payload.query ?? {};
    const sorts = [sortText(query.sortKey1, query.sortDirection1), sortText(query.sortKey2, query.sortDirection2)].filter(Boolean).join(", ") || "초과일수 내림차순";

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "피그매니저"; workbook.created = new Date();
    const usedNames = new Set<string>();
    payload.sections.slice(0, 10).forEach((section) => {
      const columns = (section.columns ?? []).slice(0, 12);
      const rows = (section.rows ?? []).slice(0, 5000);
      const title = safeText(section.title || "관리대상모돈");
      let sheetName = title.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "관리대상모돈";
      while (usedNames.has(sheetName)) sheetName = `${sheetName.slice(0, 28)}_${usedNames.size}`;
      usedNames.add(sheetName);
      const last = columnLetter(columns.length + 3);
      const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 5 }], pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { defaultRowHeight: 20 } });
      sheet.mergeCells(`A1:${last}1`); sheet.getCell("A1").value = title; sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } }; sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(1).height = 30;
      sheet.mergeCells(`A2:${last}2`); sheet.getCell("A2").value = `농장명: ${safeText(payload.farmName || "참든팜")}    조회기준일: ${query.baseDate || ""}    정렬기준: ${sorts}`; sheet.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF52635D" } }; sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
      sheet.mergeCells(`A3:${last}3`); sheet.getCell("A3").value = `< ${safeText(section.criteria || "")} >`; sheet.getCell("A3").font = { name: "Arial", size: 10, bold: true, color: { argb: "FF283A34" } }; sheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(5).values = ["번호", "모돈번호", "품종", ...columns.map((column) => safeText(column.label))]; sheet.getRow(5).height = 24;
      sheet.getRow(5).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146F5B" } }; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: "FF0F5549" } }, right: { style: "thin", color: { argb: "FFDCE5E1" } } }; });
      if (!rows.length) {
        sheet.mergeCells(`A6:${last}6`); sheet.getCell("A6").value = "해당하는 모돈이 없습니다."; sheet.getCell("A6").alignment = { horizontal: "center", vertical: "middle" }; sheet.getCell("A6").font = { name: "Arial", size: 10, color: { argb: "FF6C7C76" } };
      }
      rows.forEach((row, index) => {
        const values = row.values ?? {};
        const line = sheet.addRow([index + 1, safeText(row.animalNo), safeText(row.breed), ...columns.map((column) => {
          const value = values[column.key || ""];
          if (value === null || value === undefined || value === "") return null;
          if (column.type === "date") return parseDate(value);
          if (column.type === "number") return typeof value === "number" ? value : Number.isFinite(Number(value)) ? Number(value) : safeText(value);
          return safeText(value);
        })]);
        line.font = { name: "Arial", size: 10, color: { argb: "FF283A34" } }; line.height = 21;
        line.eachCell({ includeEmpty: true }, (cell) => { cell.alignment = { horizontal: "center", vertical: "middle" }; cell.border = { bottom: { style: "hair", color: { argb: "FFDCE5E1" } } }; });
        columns.forEach((column, columnIndex) => { if (column.type === "date") line.getCell(columnIndex + 4).numFmt = "yyyy-mm-dd"; if (column.type === "number") line.getCell(columnIndex + 4).numFmt = "#,##0"; });
      });
      sheet.columns = [{ width: 7 }, { width: 13 }, { width: 8 }, ...columns.map((column) => ({ width: column.type === "date" ? 13 : 12 }))];
      sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D"; sheet.pageSetup.margins = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("관리대상모돈.xlsx")}`, "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "엑셀 파일 생성 중 오류가 발생했습니다." }, { status: 500 }); }
}
