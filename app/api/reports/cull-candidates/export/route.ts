import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

type Matched = { avgTotalBorn?: boolean; avgLiveBorn?: boolean; avgWeaned?: boolean; incidentCount?: boolean; dystocia?: boolean };
type ExportRecord = {
  animalNo?: string; parity?: number; currentCull?: number | null; totalCull?: number | null;
  avgTotalBorn?: number | null; avgLiveBorn?: number | null; dystocia?: number; incidentCount?: number; avgWeaned?: number | null;
  recentTotalBorn?: number | null; recentLiveBorn?: number | null; recentWeaned?: number | null; bcs?: number | null;
  currentStatus?: string; lastWorkDate?: string; elapsedDays?: number | null; matched?: Matched;
};
type ExportQuery = { startDate?: string; endDate?: string; parityFrom?: string; parityTo?: string; sortKey?: string; sortDirection?: "asc" | "desc" };

const sortLabels: Record<string, string> = {
  elapsedDays: "경과일", animalNo: "모돈번호", parity: "산차", currentCull: "현산차 생시도태", totalCull: "전체산차 생시도태",
  avgTotalBorn: "평균총산", avgLiveBorn: "평균실산", dystocia: "난산/후산", incidentCount: "총사고횟수", avgWeaned: "평균이유",
  recentTotalBorn: "최근총산", recentLiveBorn: "최근실산", recentWeaned: "최근이유", bcs: "BCS", currentStatus: "현재상태", lastWorkDate: "최근작업일",
};

function safeText(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
// ExcelJS는 날짜를 UTC 기준 일련번호로 저장하므로 UTC 자정으로 만들어야 서버 시간대(한국 등)와 관계없이 같은 날짜로 표시된다.
function parseDate(value: unknown) { const text = String(value ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null; const date = new Date(`${text}T00:00:00Z`); return Number.isNaN(date.getTime()) ? null : date; }
function numberOrBlank(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function countOrBlank(value: unknown) { return typeof value === "number" && value > 0 ? value : null; }

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { records?: ExportRecord[]; query?: ExportQuery; farmName?: string };
    if (!Array.isArray(payload.records)) return NextResponse.json({ message: "다운로드할 도태 예정돈 기록이 올바르지 않습니다." }, { status: 400 });
    const query = payload.query ?? {};
    // 화면에서 산출·정렬한 순서를 그대로 사용한다.
    const records = payload.records.slice(0, 5000);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "피그매니저"; workbook.created = new Date();
    const sheet = workbook.addWorksheet("도태예정돈", { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { defaultRowHeight: 20 } });
    sheet.mergeCells("A1:Q1"); sheet.getCell("A1").value = "도태 예정돈"; sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } }; sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(1).height = 30;
    sheet.mergeCells("A2:Q2"); sheet.getCell("A2").value = `농장명: ${safeText(payload.farmName || "참든팜")}    최근작업일: ${query.startDate || ""} ~ ${query.endDate || ""}    산차: ${safeText(query.parityFrom ?? "")}~${safeText(query.parityTo ?? "")}    정렬: ${sortLabels[query.sortKey || ""] || "경과일"} ${query.sortDirection === "asc" ? "오름차순" : "내림차순"}`; sheet.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF52635D" } }; sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(2).height = 22;
    const headers = ["번호", "개체번호", "산차", "현산차 생시도태", "전체산차 생시도태", "평균총산", "평균실산", "난산/후산", "총사고횟수", "평균이유", "최근총산", "최근실산", "최근이유", "BCS", "현재상태", "최근작업일", "경과일"];
    sheet.getRow(4).values = headers; sheet.getRow(4).height = 30;
    sheet.getRow(4).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146F5B" } }; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: "FF0F5549" } }, right: { style: "thin", color: { argb: "FFDCE5E1" } } }; });
    const highlight = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE8243C" } };
    records.forEach((record, index) => {
      const matched = record.matched ?? {};
      const row = sheet.addRow([
        index + 1, safeText(record.animalNo), numberOrBlank(record.parity), numberOrBlank(record.currentCull), numberOrBlank(record.totalCull),
        numberOrBlank(record.avgTotalBorn), numberOrBlank(record.avgLiveBorn), countOrBlank(record.dystocia), countOrBlank(record.incidentCount), numberOrBlank(record.avgWeaned),
        numberOrBlank(record.recentTotalBorn), numberOrBlank(record.recentLiveBorn), numberOrBlank(record.recentWeaned), numberOrBlank(record.bcs),
        safeText(record.currentStatus), parseDate(record.lastWorkDate), numberOrBlank(record.elapsedDays),
      ]);
      row.font = { name: "Arial", size: 10, color: { argb: "FF283A34" } }; row.height = 21;
      row.eachCell({ includeEmpty: true }, (cell) => { cell.alignment = { horizontal: "center", vertical: "middle" }; cell.border = { bottom: { style: "hair", color: { argb: "FFDCE5E1" } } }; });
      [6, 7, 10].forEach((column) => { row.getCell(column).numFmt = "0.0"; });
      row.getCell(16).numFmt = "yyyy-mm-dd";
      const marks: Array<[number, boolean | undefined]> = [[6, matched.avgTotalBorn], [7, matched.avgLiveBorn], [8, matched.dystocia && (record.dystocia ?? 0) > 0], [9, matched.incidentCount && (record.incidentCount ?? 0) > 0], [10, matched.avgWeaned]];
      marks.forEach(([column, on]) => { if (on) { row.getCell(column).fill = highlight; row.getCell(column).font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; } });
    });
    sheet.columns = [{ width: 7 }, { width: 13 }, { width: 7 }, { width: 10 }, { width: 10 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 7 }, { width: 11 }, { width: 13 }, { width: 8 }];
    sheet.autoFilter = { from: "A4", to: `Q${Math.max(4, records.length + 4)}` }; sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D"; sheet.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("도태예정돈.xlsx")}`, "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "엑셀 파일 생성 중 오류가 발생했습니다." }, { status: 500 }); }
}
