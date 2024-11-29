import * as fs from "fs";
import * as xlsx from "xlsx";

const filePath: string = "./questions_utf8.csv";
const fileContent: string = fs.readFileSync(filePath, "utf8");

const workbook: xlsx.WorkBook = xlsx.read(fileContent, { type: "string" });

const sheetName: string = workbook.SheetNames[0];
const sheet: xlsx.WorkSheet = workbook.Sheets[sheetName];

const data: any[] = xlsx.utils.sheet_to_json(sheet);

function getRandomRows<T>(count: number): T[] {
  const filteredData = data.filter((row) => row.ject === "Matematyka");

  const shuffled = filteredData.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
function getRandomRowsTraining<T>(count: number, type: string[]): T[] {
  let trimmedType = type.map((x) => x.trim().toLowerCase());
  let filteredData;
  console.log(type);
  if (type.length == 0) {
    filteredData = data.filter(function (row) {
      return row.ject === "Matematyka";
    });
  } else {
    filteredData = data.filter(function (row) {
      return (
        row.ject === "Matematyka" &&
        row.Category && // Ensure row.Category exists
        trimmedType.includes(row.Category.toLowerCase().trim())
      );
    });
  }

  const shuffled = filteredData.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
module.exports = { getRandomRows, getRandomRowsTraining };
