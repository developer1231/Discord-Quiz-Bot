"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var xlsx = require("xlsx");
var filePath = "./questions_utf8.csv";
var fileContent = fs.readFileSync(filePath, "utf8");
var workbook = xlsx.read(fileContent, { type: "string" });
var sheetName = workbook.SheetNames[0];
var sheet = workbook.Sheets[sheetName];
var data = xlsx.utils.sheet_to_json(sheet);
function getRandomRows(count) {
    var filteredData = data.filter(function (row) { return row.ject === "Matematyka"; });
    var shuffled = filteredData.sort(function () { return 0.5 - Math.random(); });
    return shuffled.slice(0, count);
}
function getRandomRowsTraining(count, type) {
    var trimmedType = type.map(function (x) { return x.trim().toLowerCase(); });
    var filteredData;
    console.log(type);
    if (type.length == 0) {
        filteredData = data.filter(function (row) {
            return row.ject === "Matematyka";
        });
    }
    else {
        filteredData = data.filter(function (row) {
            return (row.ject === "Matematyka" &&
                row.Category && // Ensure row.Category exists
                trimmedType.includes(row.Category.toLowerCase().trim()));
        });
    }
    var shuffled = filteredData.sort(function () { return 0.5 - Math.random(); });
    return shuffled.slice(0, count);
}
module.exports = { getRandomRows: getRandomRows, getRandomRowsTraining: getRandomRowsTraining };
