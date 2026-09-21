import fs from "node:fs/promises";
import ExcelJS from "exceljs";

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(await fs.readFile("public/templates/모돈이유등록양식.xlsx"));
const sheet = workbook.getWorksheet("이유등록");
sheet.getRow(7).values = [,
  "2871", "5317", 2, new Date(2026, 8, 13), new Date(2026, 9, 11), 10, 0,
  7.2, 72, "예", 2, 0, 0, 0, "", 0, 0, "", "임신사 1동", "이유자돈사 A군", "잔여 2두 재포유",
];
const bytes = await workbook.xlsx.writeBuffer();
const body = new FormData();
body.append("file", new File([bytes], "이유업로드검증.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
const response = await fetch("http://localhost:3000/api/weaning/import", { method: "POST", body });
console.log(response.status, await response.text());
