import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

// 여러 보고서가 함께 쓰는 표 엑셀 내보내기: 2단 머리글(묶음 머리글 + 하위 머리글)과 행 값을 그대로 시트로 만든다.
type Header = { label?: string; children?: string[] };
type Cell = string | number | null;

function safeText(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function columnLetter(index: number) { let n = index; let text = ""; while (n > 0) { const m = (n - 1) % 26; text = String.fromCharCode(65 + m) + text; n = Math.floor((n - 1) / 26); } return text; }

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { title?: string; sheetName?: string; fileName?: string; infoLines?: string[]; headers?: Header[]; rows?: Cell[][]; totalRows?: Cell[][]; leftColumns?: number; mergeGroups?: boolean };
    if (!Array.isArray(payload.headers) || !Array.isArray(payload.rows)) return NextResponse.json({ message: "다운로드할 표가 올바르지 않습니다." }, { status: 400 });
    const headers = payload.headers.slice(0, 80);
    const leaves = headers.flatMap((header) => header.children?.length ? header.children : [header.label ?? ""]);
    const columnCount = Math.max(1, leaves.length);
    const last = columnLetter(columnCount);
    const twoLevel = headers.some((header) => header.children?.length);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "피그매니저"; workbook.created = new Date();
    const sheet = workbook.addWorksheet(safeText(payload.sheetName || payload.title || "보고서").replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "보고서", { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { defaultRowHeight: 18 } });
    sheet.mergeCells(`A1:${last}1`); sheet.getCell("A1").value = safeText(payload.title || "보고서"); sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } }; sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(1).height = 30;
    let rowNumber = 2;
    (payload.infoLines ?? []).slice(0, 5).forEach((line) => { sheet.mergeCells(`A${rowNumber}:${last}${rowNumber}`); sheet.getCell(`A${rowNumber}`).value = safeText(line); sheet.getCell(`A${rowNumber}`).font = { name: "Arial", size: 10, color: { argb: "FF52635D" } }; sheet.getCell(`A${rowNumber}`).alignment = { horizontal: "center" }; rowNumber += 1; });
    rowNumber += 1;
    const thin = { style: "thin" as const, color: { argb: "FF9AA9A3" } }; const border = { top: thin, bottom: thin, left: thin, right: thin };
    const styleHead = (cell: ExcelJS.Cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146F5B" } }; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = border; };
    const headTop = rowNumber; const headBottom = twoLevel ? rowNumber + 1 : rowNumber;
    let column = 1;
    headers.forEach((header) => {
      const span = header.children?.length || 1;
      const top = sheet.getCell(headTop, column); top.value = safeText(header.label);
      if (twoLevel) {
        if (header.children?.length) { if (span > 1) sheet.mergeCells(headTop, column, headTop, column + span - 1); header.children.forEach((child, index) => { sheet.getCell(headBottom, column + index).value = safeText(child); }); }
        else sheet.mergeCells(headTop, column, headBottom, column);
      }
      column += span;
    });
    for (let r = headTop; r <= headBottom; r += 1) { sheet.getRow(r).height = 22; for (let c = 1; c <= columnCount; c += 1) styleHead(sheet.getCell(r, c)); }
    rowNumber = headBottom + 1;
    const leftColumns = Math.max(1, Math.min(columnCount, payload.leftColumns ?? 1));
    const writeRow = (values: Cell[], bold: boolean) => {
      const line = sheet.getRow(rowNumber);
      for (let c = 1; c <= columnCount; c += 1) {
        const raw = values[c - 1]; const cell = line.getCell(c);
        cell.value = typeof raw === "number" && Number.isFinite(raw) ? raw : raw === null || raw === undefined ? null : safeText(raw);
        cell.border = border; cell.font = { name: "Arial", size: 10, bold, color: { argb: "FF283A34" } };
        cell.alignment = { horizontal: c <= leftColumns ? "center" : "right", vertical: "middle" };
        if (typeof raw === "number") cell.numFmt = Number.isInteger(raw) ? "#,##0" : (String(raw).split(".")[1]?.length ?? 0) >= 2 ? "#,##0.00" : "#,##0.0";
        if (bold) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF4F1" } };
      }
      rowNumber += 1;
    };
    payload.rows.slice(0, 5000).forEach((values) => writeRow(Array.isArray(values) ? values : [], false));
    // mergeGroups: 첫 열의 같은 묶음 이름은 세로로 합치고, 첫 열과 둘째 열이 같으면 가로로 합친다(구분/항목 2열 표).
    if (payload.mergeGroups && leftColumns >= 2) {
      const bodyTop = headBottom + 1; const bodyRows = payload.rows.slice(0, 5000);
      let index = 0;
      while (index < bodyRows.length) {
        const group = bodyRows[index]?.[0]; let endIndex = index;
        while (endIndex + 1 < bodyRows.length && bodyRows[endIndex + 1]?.[0] === group && group !== null && group !== "") endIndex += 1;
        if (endIndex === index && bodyRows[index]?.[1] === group) sheet.mergeCells(bodyTop + index, 1, bodyTop + index, 2);
        else if (endIndex > index) sheet.mergeCells(bodyTop + index, 1, bodyTop + endIndex, 1);
        index = endIndex + 1;
      }
    }
    (payload.totalRows ?? []).slice(0, 10).forEach((values) => writeRow(Array.isArray(values) ? values : [], true));
    sheet.columns = leaves.map((label, index) => ({ width: index < leftColumns ? Math.max(12, Math.min(22, String(label).length * 2 + 6)) : Math.max(7, Math.min(14, String(label).length * 2 + 3)) }));
    sheet.views = [{ state: "frozen", xSplit: leftColumns, ySplit: headBottom }];
    sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D"; sheet.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${safeText(payload.fileName || payload.title || "보고서")}.xlsx`)}`, "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "엑셀 파일 생성 중 오류가 발생했습니다." }, { status: 500 }); }
}
