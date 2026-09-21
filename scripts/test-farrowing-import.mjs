import fs from "node:fs/promises";
import ExcelJS from "exceljs";

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(await fs.readFile("outputs/01a0b737/farrowing-template/모돈분만등록양식.xlsx"));
const sheet = workbook.getWorksheet("분만등록");
sheet.getRow(7).values = [, "2960", "7062", "YL", 1, new Date(2026, 4, 20), new Date(2026, 8, 12), "정상", "분만사 1동", 15, 1, 1, 7, 6, 1, 1, 0, { formula: "MAX(0,L7+M7-N7-O7-P7)" }, 1.35, 17.55, "암수 직접 입력·포유개시 자동계산 검증"];
const bytes = await workbook.xlsx.writeBuffer();
const body = new FormData();
body.append("file", new File([bytes], "분만업로드검증.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
const response = await fetch("http://localhost:3000/api/farrowing/import", { method: "POST", body });
console.log(response.status, await response.text());
