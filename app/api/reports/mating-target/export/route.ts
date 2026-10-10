import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

type Row = { label?: string; start?: string; end?: string; matings?: number; matingVsTarget?: number | null; matured?: boolean; farrowings?: number | null; farrowingVsTarget?: number | null; farrowingRate?: number | null; weaned?: number | null; weanedVsTarget?: number | null };
type Trio = { matingVsTarget?: number | null; farrowingVsTarget?: number | null; weanedVsTarget?: number | null };
type Summary = { matingTarget?: number | null; weanedTarget?: number | null; totals?: { matings?: number; matingVsTarget?: number | null; farrowings?: number; farrowingVsTarget?: number | null; farrowingRate?: number | null; weaned?: number; weanedVsTarget?: number | null }; stdDev?: Trio; variance?: Trio };
type Query = { farrowingTarget?: string; farrowingRate?: string; weanedPerLitter?: string; unitCount?: string; unit?: string };

const unitLabels: Record<string, string> = { day: "일", week: "주", month: "월", year: "년" };
function safeText(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
function value(input: unknown) { return typeof input === "number" && Number.isFinite(input) ? input : null; }

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { rows?: Row[]; summary?: Summary; start?: string; end?: string; query?: Query; farmName?: string };
    if (!Array.isArray(payload.rows) || !payload.summary) return NextResponse.json({ message: "다운로드할 교배목표 달성율이 올바르지 않습니다." }, { status: 400 });
    const rows = payload.rows.slice(0, 60); const summary = payload.summary; const query = payload.query ?? {};
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "피그매니저"; workbook.created = new Date();
    const sheet = workbook.addWorksheet("교배목표달성율", { views: [{ state: "frozen", ySplit: 6 }], pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { defaultRowHeight: 18 } });
    sheet.mergeCells("A1:I1"); sheet.getCell("A1").value = "교배목표 달성율"; sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } }; sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" }; sheet.getRow(1).height = 30;
    sheet.mergeCells("A2:I2"); sheet.getCell("A2").value = `농장명: ${safeText(payload.farmName || "참든팜")}    산출기간: ${safeText(payload.start)} ~ ${safeText(payload.end)}`; sheet.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF52635D" } }; sheet.getCell("A2").alignment = { horizontal: "center" };
    const matingTarget = value(summary.matingTarget); const weanedTarget = value(summary.weanedTarget);
    sheet.mergeCells("A3:I3"); sheet.getCell("A3").value = `배치: ${safeText(query.unitCount || "1")}${unitLabels[query.unit || "week"] || "주"}    목표분만: ${query.farrowingTarget ? `${safeText(query.farrowingTarget)} 복당` : "미입력"}    목표분만율: ${query.farrowingRate ? `${safeText(query.farrowingRate)} %` : "미입력"}    목표교배: ${matingTarget ? `${Math.round(matingTarget * 10) / 10} 복당` : "-"}    목표이유두수: ${query.weanedPerLitter ? `${safeText(query.weanedPerLitter)} 두` : "미입력"}    총: ${weanedTarget ? `${weanedTarget} 두` : "-"}`; sheet.getCell("A3").font = { name: "Arial", size: 10, color: { argb: "FF283A34" } }; sheet.getCell("A3").alignment = { horizontal: "center" };

    const thin = { style: "thin" as const, color: { argb: "FF9AA9A3" } }; const border = { top: thin, bottom: thin, left: thin, right: thin };
    const headers = ["구간", "기간", "교배복수", "교배목표대비(%)", "분만복수", "분만목표대비(%)", "분만율(%)", "이유자돈", "이유목표대비(%)"];
    const head = sheet.getRow(6); head.values = headers; head.height = 24;
    headers.forEach((_, index) => { const cell = head.getCell(index + 1); cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146F5B" } }; cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = border; });
    const styleRow = (row: ExcelJS.Row, bold = false) => { for (let column = 1; column <= headers.length; column += 1) { const cell = row.getCell(column); cell.border = border; cell.alignment = { horizontal: column <= 2 ? "center" : "right", vertical: "middle" }; cell.font = { name: "Arial", size: 10, bold, color: { argb: "FF283A34" } }; if (column >= 3) cell.numFmt = "#,##0"; if (bold) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF4F1" } }; } };
    rows.forEach((row) => {
      const line = sheet.addRow([safeText(row.label), `${safeText(row.start)} ~ ${safeText(row.end)}`, value(row.matings), value(row.matingVsTarget), row.matured ? value(row.farrowings) : "분만 전", value(row.farrowingVsTarget), value(row.farrowingRate), row.matured ? value(row.weaned) : null, value(row.weanedVsTarget)]);
      styleRow(line);
    });
    const t = summary.totals ?? {};
    styleRow(sheet.addRow(["계", "", value(t.matings), value(t.matingVsTarget), value(t.farrowings), value(t.farrowingVsTarget), value(t.farrowingRate), value(t.weaned), value(t.weanedVsTarget)]), true);
    styleRow(sheet.addRow(["표준편차", "", null, value(summary.stdDev?.matingVsTarget), null, value(summary.stdDev?.farrowingVsTarget), null, null, value(summary.stdDev?.weanedVsTarget)]), true);
    styleRow(sheet.addRow(["분산", "", null, value(summary.variance?.matingVsTarget), null, value(summary.variance?.farrowingVsTarget), null, null, value(summary.variance?.weanedVsTarget)]), true);
    sheet.columns = [{ width: 13 }, { width: 25 }, { width: 10 }, { width: 13 }, { width: 10 }, { width: 13 }, { width: 10 }, { width: 10 }, { width: 13 }];
    sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D"; sheet.pageSetup.margins = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("교배목표달성율.xlsx")}`, "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "엑셀 파일 생성 중 오류가 발생했습니다." }, { status: 500 }); }
}
