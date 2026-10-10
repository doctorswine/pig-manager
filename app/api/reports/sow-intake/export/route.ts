import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

type ExportRecord = {
  animalNo?: string;
  earTag?: string;
  breed?: string;
  parity?: string;
  birthDate?: string;
  intakeDate?: string;
  weight?: string;
  status?: string;
  source?: string;
  note?: string;
};

type ExportQuery = {
  fromDate?: string;
  toDate?: string;
  sortKey?: "animalNo" | "earTag" | "parity" | "breed" | "birthDate";
  sortDirection?: "asc" | "desc";
};

const sortLabels = { animalNo: "모돈번호", earTag: "이각번호", parity: "산차", breed: "품종", birthDate: "출생일" } as const;

function safeText(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function parseDate(value: unknown) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { records?: ExportRecord[]; query?: ExportQuery; farmName?: string };
    const query = payload.query ?? {};
    if (!Array.isArray(payload.records)) return NextResponse.json({ message: "다운로드할 전입 기록이 올바르지 않습니다." }, { status: 400 });
    const sortKey = query.sortKey && query.sortKey in sortLabels ? query.sortKey : "animalNo";
    const records = payload.records.slice(0, 5000)
      .filter((record) => (!query.fromDate || String(record.intakeDate ?? "") >= query.fromDate) && (!query.toDate || String(record.intakeDate ?? "") <= query.toDate))
      .sort((left, right) => {
        const compared = sortKey === "parity"
          ? Number(left.parity || 0) - Number(right.parity || 0)
          : String(left[sortKey] ?? "").localeCompare(String(right[sortKey] ?? ""), "ko", { numeric: true });
        return query.sortDirection === "desc" ? -compared : compared;
      });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "피그매니저";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("모돈전입대장", {
      views: [{ state: "frozen", ySplit: 4 }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
      properties: { defaultRowHeight: 20 },
    });

    sheet.mergeCells("A1:K1");
    sheet.getCell("A1").value = "모돈전입대장";
    sheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF173B32" } };
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 30;

    sheet.mergeCells("A2:K2");
    const sortLabel = sortLabels[sortKey];
    sheet.getCell("A2").value = `농장명: ${safeText(payload.farmName || "참든팜")}    조회기간: ${query.fromDate || "전체"} ~ ${query.toDate || "전체"}    정렬: ${sortLabel} ${query.sortDirection === "desc" ? "내림차순" : "오름차순"}`;
    sheet.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF52635D" } };
    sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(2).height = 22;

    const headers = ["번호", "모돈번호", "이각번호", "품종", "산차", "출생일", "전입일", "전입체중(kg)", "전입상태", "구입처", "비고"];
    sheet.getRow(4).values = headers;
    sheet.getRow(4).height = 24;
    sheet.getRow(4).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF146F5B" } };
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { bottom: { style: "thin", color: { argb: "FF0F5549" } }, right: { style: "thin", color: { argb: "FFDCE5E1" } } };
    });

    records.forEach((record, index) => {
      const row = sheet.addRow([
        index + 1,
        safeText(record.animalNo),
        safeText(record.earTag),
        safeText(record.breed),
        Number(record.parity || 0),
        parseDate(record.birthDate),
        parseDate(record.intakeDate),
        record.weight === "" || record.weight == null ? null : Number(record.weight),
        safeText(record.status),
        safeText(record.source),
        safeText(record.note),
      ]);
      row.font = { name: "Arial", size: 10, color: { argb: "FF283A34" } };
      row.alignment = { vertical: "middle" };
      row.height = 21;
      row.eachCell((cell) => { cell.border = { bottom: { style: "hair", color: { argb: "FFDCE5E1" } } }; });
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(5).alignment = { horizontal: "right", vertical: "middle" };
      row.getCell(6).numFmt = "yyyy-mm-dd";
      row.getCell(7).numFmt = "yyyy-mm-dd";
      row.getCell(8).numFmt = "#,##0.0";
      row.getCell(9).alignment = { horizontal: "center", vertical: "middle" };
    });

    sheet.columns = [
      { width: 7 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 8 }, { width: 13 },
      { width: 13 }, { width: 15 }, { width: 13 }, { width: 20 }, { width: 24 },
    ];
    sheet.autoFilter = { from: "A4", to: `K${Math.max(4, records.length + 4)}` };
    sheet.headerFooter.oddFooter = "&L피그매니저&C&P / &N&R출력일 &D";
    sheet.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("모돈전입대장.xlsx")}`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ message: "엑셀 파일 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
