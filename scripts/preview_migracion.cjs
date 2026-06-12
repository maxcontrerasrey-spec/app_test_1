const xlsx = require('@mylinkpi/xlsx');

const workbook = xlsx.readFile('migracion_folios.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { raw: false, defval: null });

console.log(`\n\n--- PREVIEW DE MIGRACIÓN ---`);
console.log(`Total de filas encontradas: ${data.length}`);
console.log(`Columnas detectadas: ${Object.keys(data[0] || {}).join(', ')}`);
console.log(`\nPrimeros 2 registros (Muestra):`);
console.log(JSON.stringify(data.slice(0, 2), null, 2));
