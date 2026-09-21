import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";
import JSZip from "jszip";

const outputDir = path.resolve("outputs/01a0b737/mating-template");
const outputPath = path.join(outputDir, "모돈교배등록양식.xlsx");
const previewPath = path.join(outputDir, "모돈교배등록양식-preview.png");

await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("교배등록");
sheet.showGridLines = false;
sheet.tabColor = "#146F5B";

sheet.getRange("A2:O2").merge();
sheet.getRange("A2").values = [["모돈 교배 일괄등록 양식"]];
sheet.getRange("A2:O2").format = {
  font: { name: "Arial", size: 16, bold: true, color: "#17231F" },
  verticalAlignment: "center",
};
sheet.getRange("A2:O2").format.rowHeight = 28;

sheet.getRange("A3:O3").merge();
sheet.getRange("A3").values = [["필수 항목(*)을 입력한 뒤 .xlsx 형식으로 저장하여 교배 관리 화면의 ‘데이터 업로드’에서 선택하세요."]];
sheet.getRange("A3:O3").format = {
  font: { name: "Arial", size: 10, italic: true, color: "#61736C" },
  verticalAlignment: "center",
};

sheet.getRange("A4:O4").merge();
sheet.getRange("A4").values = [["날짜 형식: 2026-09-19 · 품종: F1/YY/LY/F2/YL/LL/DD/기타 · 교배방법: 인공/자연 · 최대 1,000행"]];
sheet.getRange("A4:O4").format = {
  fill: "#FFF7DA",
  font: { name: "Arial", size: 10, color: "#6B5412" },
  verticalAlignment: "center",
};

const headers = [[
  "모돈번호*", "이각번호", "품종", "산차", "교배일*",
  "웅돈1번호", "웅돈1방법", "웅돈2번호", "웅돈2방법",
  "웅돈3번호", "웅돈3방법", "등지방(mm)", "교배자", "장소", "비고",
]];
sheet.getRange("A6:O6").values = headers;
sheet.getRange("A6:O6").format = {
  fill: "#146F5B",
  font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: { preset: "inside", style: "thin", color: "#FFFFFF" },
};
sheet.getRange("A6:O6").format.rowHeight = 26;

const inputRange = sheet.getRange("A7:O1006");
inputRange.format = {
  font: { name: "Arial", size: 10, color: "#24352F" },
  verticalAlignment: "center",
};
sheet.getRange("A7:O26").format.borders = { preset: "inside", style: "thin", color: "#E6ECE9" };
sheet.getRange("A7:O26").format.rowHeight = 23;
sheet.getRange("A7:A1006").format.numberFormat = "@";
sheet.getRange("B7:B1006").format.numberFormat = "@";
sheet.getRange("E7:E1006").format.numberFormat = "yyyy-mm-dd";
sheet.getRange("F7:K1006").format.numberFormat = "@";
sheet.getRange("C7:C1006").dataValidation = { rule: { type: "list", values: ["F1", "YY", "LY", "F2", "YL", "LL", "DD", "기타"] } };
sheet.getRange("G7:G1006").dataValidation = { rule: { type: "list", values: ["인공", "자연"] } };
sheet.getRange("I7:I1006").dataValidation = { rule: { type: "list", values: ["인공", "자연"] } };
sheet.getRange("K7:K1006").dataValidation = { rule: { type: "list", values: ["인공", "자연"] } };
sheet.dataValidations.add({ range: "D7:D1006", rule: { type: "whole", operator: "between", formula1: 0, formula2: 20 } });
sheet.dataValidations.add({ range: "L7:L1006", rule: { type: "decimal", operator: "between", formula1: 0, formula2: 100 } });

const widths = [15, 15, 10, 9, 14, 16, 13, 16, 13, 16, 13, 14, 14, 18, 30];
widths.forEach((width, index) => {
  sheet.getRangeByIndexes(0, index, 1006, 1).format.columnWidth = width;
});
sheet.freezePanes.freezeRows(6);

workbook.recalculate();
const inspection = await workbook.inspect({
  kind: "region",
  sheetId: "교배등록",
  range: "A2:O8",
  maxChars: 6000,
});
console.log(inspection.ndjson ?? inspection);
const formulaInspection = await workbook.inspect({
  kind: "formula",
  sheetId: "교배등록",
  range: "A1:O1006",
  maxChars: 2000,
  options: { maxResults: 20 },
});
console.log(formulaInspection.ndjson ?? formulaInspection);

const preview = await workbook.render({ sheetName: "교배등록", range: "A1:O26", scale: 1, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
const rawPath = path.join(outputDir, ".모돈교배등록양식-raw.xlsx");
await output.save(rawPath);

// artifact-tool은 표준 네임스페이스 접두사를 사용합니다. ExcelJS 기반 업로드
// 파서와도 호환되도록 workbook.xml 루트의 접두사만 기본 네임스페이스로 정규화합니다.
const zip = await JSZip.loadAsync(await fs.readFile(rawPath));
const spreadsheetXmlPaths = [
  "xl/workbook.xml",
  "xl/sharedStrings.xml",
  "xl/styles.xml",
  "xl/worksheets/sheet1.xml",
];
for (const xmlPath of spreadsheetXmlPaths) {
  const entry = zip.file(xmlPath);
  if (!entry) continue;
  const xml = await entry.async("string");
  zip.file(xmlPath, xml.replace(/xmlns:x=/g, "xmlns=").replace(/<\/?x:/g, (tag) => tag.replace("x:", "")));
}
await fs.writeFile(outputPath, await zip.generateAsync({ type: "nodebuffer" }));
await fs.unlink(rawPath);
console.log(JSON.stringify({ outputPath, previewPath }));
