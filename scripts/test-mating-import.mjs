import fs from "node:fs/promises";
import ExcelJS from "exceljs";

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(await fs.readFile("outputs/01a0b737/mating-template/모돈교배등록양식.xlsx"));
const sheet = workbook.getWorksheet("교배등록");
sheet.getRow(7).values = [
  , "2942", "66123", "F1", 0, new Date(2026, 8, 18),
  "", "인공", "", "인공", "", "인공", 14.5, "업로드검증", "교배사 1동", "웅돈번호 없는 일괄등록 검증",
];
sheet.getCell("E7").numFmt = "yyyy-mm-dd";
const bytes = await workbook.xlsx.writeBuffer();
const body = new FormData();
body.append("file", new File([bytes], "교배업로드검증.xlsx", {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}));
const response = await fetch("http://localhost:3000/api/mating/import", { method: "POST", body });
console.log(response.status, await response.text());
