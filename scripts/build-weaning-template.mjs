import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";
import JSZip from "jszip";

const outputDir = path.resolve("outputs/01a0b737/weaning-template");
const outputPath = path.join(outputDir, "모돈이유등록양식.xlsx");
const publicPath = path.resolve("public/templates/모돈이유등록양식.xlsx");
const previewPath = path.join(outputDir, "모돈이유등록양식-preview.png");
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(path.dirname(publicPath), { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("이유등록");
sheet.showGridLines = false;
sheet.tabColor = "#146F5B";

sheet.getRange("A2:U2").merge();
sheet.getRange("A2").values = [["모돈 이유 일괄등록 양식"]];
sheet.getRange("A2:U2").format = { font: { name: "Arial", size: 16, bold: true, color: "#17231F" }, verticalAlignment: "center" };
sheet.getRange("A2:U2").format.rowHeight = 28;
sheet.getRange("A3:U3").merge();
sheet.getRange("A3").values = [["필수 항목(*)을 입력한 뒤 .xlsx 형식으로 저장하여 이유 관리 화면의 ‘데이터 업로드’에서 선택하세요."]];
sheet.getRange("A3:U3").format = { font: { name: "Arial", size: 10, italic: true, color: "#61736C" }, verticalAlignment: "center" };
sheet.getRange("A4:U4").merge();
sheet.getRange("A4").values = [["분만일·이각번호·산차는 비워도 최근 분만 기록에서 자동 연결됩니다. 이유 후 잔여두수는 0이 아니어도 등록됩니다. · 최대 1,000행"]];
sheet.getRange("A4:U4").format = { fill: "#FFF7DA", font: { name: "Arial", size: 10, color: "#6B5412" }, verticalAlignment: "center" };

sheet.getRange("A6:U6").values = [[
  "모돈번호*", "이각번호", "산차", "분만일", "이유일*", "이유두수(암)*", "이유두수(수)*",
  "자돈평균체중(kg)", "자돈총체중(kg)", "재포유여부", "재포유두수(암)", "재포유두수(수)",
  "양자전입(암)", "양자전입(수)", "전출모돈", "양자전출(암)", "양자전출(수)", "전입모돈",
  "모돈이동장소", "자돈이동", "비고",
]];
sheet.getRange("A6:U6").format = { fill: "#146F5B", font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", borders: { preset: "inside", style: "thin", color: "#FFFFFF" } };
sheet.getRange("A6:U6").format.rowHeight = 30;

sheet.getRange("A7:U1006").format = { font: { name: "Arial", size: 10, color: "#24352F" }, verticalAlignment: "center" };
sheet.getRange("A7:U26").format.borders = { preset: "inside", style: "thin", color: "#E6ECE9" };
sheet.getRange("A7:U26").format.rowHeight = 23;
sheet.getRange("A7:B1006").format.numberFormat = "@";
sheet.getRange("O7:R1006").format.numberFormat = "@";
sheet.getRange("D7:E1006").format.numberFormat = "yyyy-mm-dd";
sheet.getRange("J7:J1006").dataValidation = { rule: { type: "list", values: ["아니오", "예"] } };
for (const column of ["C", "F", "G", "K", "L", "M", "N", "P", "Q"]) sheet.dataValidations.add({ range: `${column}7:${column}1006`, rule: { type: "whole", operator: "between", formula1: 0, formula2: 100 } });
for (const column of ["H", "I"]) sheet.dataValidations.add({ range: `${column}7:${column}1006`, rule: { type: "decimal", operator: "between", formula1: 0, formula2: 10000 } });

const widths = [15, 15, 9, 14, 14, 16, 16, 19, 19, 14, 18, 18, 16, 16, 16, 16, 16, 16, 19, 21, 30];
widths.forEach((width, index) => { sheet.getRangeByIndexes(0, index, 1006, 1).format.columnWidth = width; });
sheet.freezePanes.freezeRows(6);

workbook.recalculate();
const check = await workbook.inspect({ kind: "region", sheetId: "이유등록", range: "A2:U8", maxChars: 7000 });
console.log(check.ndjson ?? check);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" });
console.log(errors.ndjson ?? errors);
const preview = await workbook.render({ sheetName: "이유등록", range: "A1:U26", scale: 1, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
const rawPath = path.join(outputDir, ".모돈이유등록양식-raw.xlsx");
await output.save(rawPath);
const zip = await JSZip.loadAsync(await fs.readFile(rawPath));
for (const xmlPath of ["xl/workbook.xml", "xl/sharedStrings.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) {
  const entry = zip.file(xmlPath);
  if (!entry) continue;
  const xml = await entry.async("string");
  zip.file(xmlPath, xml.replace(/xmlns:x=/g, "xmlns=").replace(/<\/?x:/g, (tag) => tag.replace("x:", "")));
}
const finalBytes = await zip.generateAsync({ type: "nodebuffer" });
await fs.writeFile(outputPath, finalBytes);
await fs.writeFile(publicPath, finalBytes);
await fs.unlink(rawPath);
console.log(JSON.stringify({ outputPath, publicPath, previewPath }));
