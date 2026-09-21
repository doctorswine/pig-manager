import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";
import JSZip from "jszip";

const outputDir = path.resolve("outputs/01a0b737/farrowing-template");
const outputPath = path.join(outputDir, "모돈분만등록양식.xlsx");
const previewPath = path.join(outputDir, "모돈분만등록양식-preview.png");
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("분만등록");
sheet.showGridLines = false;
sheet.tabColor = "#146F5B";

sheet.getRange("A2:T2").merge();
sheet.getRange("A2").values = [["모돈 분만 일괄등록 양식"]];
sheet.getRange("A2:T2").format = { font: { name: "Arial", size: 16, bold: true, color: "#17231F" }, verticalAlignment: "center" };
sheet.getRange("A2:T2").format.rowHeight = 28;
sheet.getRange("A3:T3").merge();
sheet.getRange("A3").values = [["필수 항목(*)을 입력한 뒤 .xlsx 형식으로 저장하여 분만 관리 화면의 ‘데이터 업로드’에서 선택하세요."]];
sheet.getRange("A3:T3").format = { font: { name: "Arial", size: 10, italic: true, color: "#61736C" }, verticalAlignment: "center" };
sheet.getRange("A4:T4").merge();
sheet.getRange("A4").values = [["실산(암)은 자동 입력되며 암·수 두수는 직접 수정할 수 있습니다. 포유개시는 암+수-생시도태로 자동 계산됩니다. · 최대 1,000행"]];
sheet.getRange("A4:T4").format = { fill: "#FFF7DA", font: { name: "Arial", size: 10, color: "#6B5412" }, verticalAlignment: "center" };

sheet.getRange("A6:T6").values = [["모돈번호*", "이각번호", "품종", "산차", "교배일", "분만일*", "분만구분*", "분만장소", "총산*", "미라", "사산", "실산(암)", "실산(수)", "생시도태-체미", "생시도태-기형", "생시도태-기타", "포유개시-자동", "자돈평균체중(kg)", "자돈총체중(kg)", "비고"]];
sheet.getRange("A6:T6").format = { fill: "#146F5B", font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", borders: { preset: "inside", style: "thin", color: "#FFFFFF" } };
sheet.getRange("A6:T6").format.rowHeight = 28;

sheet.getRange("A7:T1006").format = { font: { name: "Arial", size: 10, color: "#24352F" }, verticalAlignment: "center" };
sheet.getRange("A7:T26").format.borders = { preset: "inside", style: "thin", color: "#E6ECE9" };
sheet.getRange("A7:T26").format.rowHeight = 23;
sheet.getRange("A7:B1006").format.numberFormat = "@";
sheet.getRange("E7:F1006").format.numberFormat = "yyyy-mm-dd";
sheet.getRange("C7:C1006").dataValidation = { rule: { type: "list", values: ["F1", "YY", "LY", "F2", "YL", "LL", "DD", "기타"] } };
sheet.getRange("G7:G1006").dataValidation = { rule: { type: "list", values: ["정상", "조산", "유도분만", "난산"] } };
for (const column of ["D", "I", "J", "K", "N", "O", "P"]) sheet.dataValidations.add({ range: `${column}7:${column}1006`, rule: { type: "whole", operator: "between", formula1: 0, formula2: 100 } });
for (const column of ["R", "S"]) sheet.dataValidations.add({ range: `${column}7:${column}1006`, rule: { type: "decimal", operator: "between", formula1: 0, formula2: 1000 } });

sheet.getRange("L7").formulas = [["=MAX(0,I7-J7-K7)"]];
sheet.getRange("L7:L1006").fillDown();
sheet.getRange("M7").formulas = [["=0"]];
sheet.getRange("M7:M1006").fillDown();
sheet.getRange("Q7").formulas = [["=MAX(0,L7+M7-N7-O7-P7)"]];
sheet.getRange("Q7:Q1006").fillDown();
sheet.getRange("L7:M1006").format.fill = "#EFF5F2";
sheet.getRange("Q7:Q1006").format.fill = "#EFF5F2";

const widths = [15, 15, 10, 9, 14, 14, 14, 18, 10, 10, 10, 15, 15, 16, 16, 16, 16, 18, 18, 28];
widths.forEach((width, index) => { sheet.getRangeByIndexes(0, index, 1006, 1).format.columnWidth = width; });
sheet.freezePanes.freezeRows(6);

workbook.recalculate();
const check = await workbook.inspect({ kind: "region", sheetId: "분만등록", range: "A2:T8", maxChars: 7000 });
console.log(check.ndjson ?? check);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" });
console.log(errors.ndjson ?? errors);
const preview = await workbook.render({ sheetName: "분만등록", range: "A1:T26", scale: 1, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
const rawPath = path.join(outputDir, ".모돈분만등록양식-raw.xlsx");
await output.save(rawPath);
const zip = await JSZip.loadAsync(await fs.readFile(rawPath));
for (const xmlPath of ["xl/workbook.xml", "xl/sharedStrings.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) {
  const entry = zip.file(xmlPath); if (!entry) continue;
  const xml = await entry.async("string");
  zip.file(xmlPath, xml.replace(/xmlns:x=/g, "xmlns=").replace(/<\/?x:/g, (tag) => tag.replace("x:", "")));
}
await fs.writeFile(outputPath, await zip.generateAsync({ type: "nodebuffer" }));
await fs.unlink(rawPath);
console.log(JSON.stringify({ outputPath, previewPath }));
