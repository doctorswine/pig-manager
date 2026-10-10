import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

type ExportRecord = {
  dueDate?: string; weekday?: string; animalNo?: string; earTag?: string; breed?: string; parityLabel?: string;
  firstMatingDays?: number | null; returnDays?: number | null; matingDate?: string;
  avgTotalBorn?: number | null; avgLiveBorn?: number | null; avgWeaned?: number | null; incidentCount?: number; note?: string;
};
type ExportQuery = { reportType?: string; startDate?: string; endDate?: string; sortKey1?: string; sortDirection1?: string; sortKey2?: string; sortDirection2?: string; minPregnancyDays?: string };

const reportLabels: Record<string, string> = { basic: "분만 예정돈(기본)", "with-incidents": "분만 예정돈대장(사고포함)" };
const sortLabels: Record<string, string> = { animalNo: "모돈번호", parity: "산차", dueDate: "예정일" };

function safeText(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
// ExcelJS는 날짜를 UTC 기준 일련번호로 저장하므로 UTC 자정으로 만들어야 서버 시간대(한국 등)와 관계없이 같은 날짜로 표시된다.
function parseDate(value: unknown) { const text = String(value ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null; const date = new Date(`${text}T00:00:00Z`); return Number.isNaN(date.getTime()) ? null : date; }
function numberOrBlank(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function sortText(key?: string, direction?: string) { return key && sortLabels[key] ? `${sortLabels[key]} ${direction === "desc" ? "내림차순" : "오름차순"}` : ""; }
function averageOf(values: Array<number | null | undefined>, digits: number) {
  const list = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!list.length) return null;
  const factor = 10 ** digits;
  return Math.round((list.reduce((sum, value) => sum + value, 0) / list.length) * factor) / factor;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { records?: ExportRecord[]; query?: ExportQuery; farmName?: string };
    if (!Array.isArray(payload.records)) return NextResponse.json({ message: "다운로드할 분만 예정돈 기록이 올바르지 않습니다." }, { status: 400 });
    const query = payload.query ?? {};
    // 화면에서 산출·정렬한 순서를 그대로 사용한다.
    const records = payload.records.slice(0, 5000);
    const withNote = query.reportType === "with-incidents";
    const title = reportLabels[query.reportType || "basic"] || reportLabels.basic;
    const lastColumn = withNote ? "O" : "N";

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "피그매니저"; workbook.created = new Date();
    const sheet = workbook.addWorksheet("분만예정돈", { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { defaultRowHeight: 20 } });
    sheet.mergeCells(`A1:${lastColumn}1`); sheet.getCell("A1").value = title; sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } }; sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(1).height = 30;
    const sorts = [sortText(query.sortKey1, query.sortDirection1), sortText(query.sortKey2, query.sortDirection2)].filter(Boolean).join(", ") || "예정일 오름차순";
    sheet.mergeCells(`A2:${lastColumn}2`); sheet.getCell("A2").value = `농장명: ${safeText(payload.farmName || "참든팜")}    산출기준: ${query.startDate || ""} ~ ${query.endDate || ""}    정렬: ${sorts}${query.minPregnancyDays ? `    수태모돈기준일: ${safeText(query.minPregnancyDays)}일` : ""}`; sheet.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF52635D" } }; sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(2).height = 22;

    const headers = ["번호", "분만예정일", "요일", "모돈번호", "이각번호", "품종", "산차", "초교배", "재귀일", "교배일", "평균총산", "평균실산", "평균이유", "사고횟수", ...(withNote ? ["비고"] : [])];
    sheet.getRow(4).values = headers; sheet.getRow(4).height = 24;
    sheet.getRow(4).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146F5B" } }; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle" }; cell.border = { bottom: { style: "thin", color: { argb: "FF0F5549" } }, right: { style: "thin", color: { argb: "FFDCE5E1" } } }; });
    records.forEach((record, index) => {
      const row = sheet.addRow([
        index + 1, parseDate(record.dueDate), safeText(record.weekday), safeText(record.animalNo), safeText(record.earTag), safeText(record.breed), safeText(record.parityLabel),
        numberOrBlank(record.firstMatingDays), numberOrBlank(record.returnDays), parseDate(record.matingDate),
        numberOrBlank(record.avgTotalBorn), numberOrBlank(record.avgLiveBorn), numberOrBlank(record.avgWeaned), numberOrBlank(record.incidentCount) ?? 0,
        ...(withNote ? [safeText(record.note)] : []),
      ]);
      row.font = { name: "Arial", size: 10, color: { argb: "FF283A34" } }; row.height = 21;
      row.eachCell({ includeEmpty: true }, (cell) => { cell.alignment = { horizontal: "center", vertical: "middle" }; cell.border = { bottom: { style: "hair", color: { argb: "FFDCE5E1" } } }; });
      [2, 10].forEach((column) => { row.getCell(column).numFmt = "yyyy-mm-dd"; });
      [11, 12, 13].forEach((column) => { row.getCell(column).numFmt = "0.0"; });
      if (withNote) row.getCell(15).alignment = { horizontal: "left", vertical: "middle" };
    });
    if (records.length) {
      // 합계 행: 두수는 개수, 초교배·재귀일은 정수 평균, 평균 성적은 평균, 사고횟수는 합계
      const total = sheet.addRow([
        "합계", null, null, `${records.length}두`, null, null, null,
        averageOf(records.map((record) => record.firstMatingDays), 0), averageOf(records.map((record) => record.returnDays), 0), null,
        averageOf(records.map((record) => record.avgTotalBorn), 1), averageOf(records.map((record) => record.avgLiveBorn), 1), averageOf(records.map((record) => record.avgWeaned), 1),
        records.reduce((sum, record) => sum + (numberOrBlank(record.incidentCount) ?? 0), 0),
        ...(withNote ? [null] : []),
      ]);
      total.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF173B32" } }; total.height = 22;
      total.eachCell({ includeEmpty: true }, (cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF4F1" } }; cell.alignment = { horizontal: "center", vertical: "middle" }; cell.border = { top: { style: "thin", color: { argb: "FF146F5B" } } }; });
      [11, 12, 13].forEach((column) => { total.getCell(column).numFmt = "0.0"; });
    }
    sheet.columns = [{ width: 7 }, { width: 13 }, { width: 6 }, { width: 13 }, { width: 11 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 13 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, ...(withNote ? [{ width: 34 }] : [])];
    sheet.autoFilter = { from: "A4", to: `${lastColumn}${Math.max(4, records.length + 4)}` }; sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D"; sheet.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("분만예정돈.xlsx")}`, "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "엑셀 파일 생성 중 오류가 발생했습니다." }, { status: 500 }); }
}
