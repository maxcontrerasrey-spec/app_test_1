import instructorsCsv from "../data/instructores.csv?raw";
import workersCsv from "../data/trabajadores.csv?raw";
import vehiclesCsv from "../data/catalogoVehiculos.csv?raw";

export type Instructor = {
  id: string;
  fullName: string;
  rut: string;
  profileCode: string;
  signature: string;
  active: boolean;
};

export type Worker = {
  id: string;
  fullName: string;
  rut: string;
  active: boolean;
};

export type VehicleCatalogItem = {
  id: string;
  brand: string;
  type: string;
  model: string;
  active: boolean;
};

function parseCsv(text: string) {
  const normalizedText = text.replace(/^\uFEFF/, "").trim();

  if (!normalizedText) {
    return [];
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let isInsideQuotes = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];
    const nextCharacter = normalizedText[index + 1];

    if (character === '"') {
      if (isInsideQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
        continue;
      }

      isInsideQuotes = !isInsideQuotes;
      continue;
    }

    if (character === "," && !isInsideQuotes) {
      currentRow.push(currentValue.trim());
      currentValue = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !isInsideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentValue.trim());
      currentValue = "";

      if (currentRow.some((value) => value.length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentValue += character;
  }

  currentRow.push(currentValue.trim());
  if (currentRow.some((value) => value.length > 0)) {
    rows.push(currentRow);
  }

  const [headers, ...dataRows] = rows;

  return dataRows.map((values) =>
    headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {})
  );
}

export const instructors: Instructor[] = parseCsv(instructorsCsv)
  .map((row) => ({
    id: row.Title,
    fullName: row.NombreCompleto,
    rut: row.Rut,
    profileCode: row.CodigoPerfilCv,
    signature: row.FirmaInstructor,
    active: row.Activo === "1"
  }))
  .filter((item) => item.active);

export const workers: Worker[] = parseCsv(workersCsv)
  .map((row) => ({
    id: row.Title,
    fullName: row.NombreCompleto,
    rut: row.Rut,
    active: row.Activo === "1"
  }))
  .filter((item) => item.active);

export const vehicleCatalog: VehicleCatalogItem[] = parseCsv(vehiclesCsv)
  .map((row) => ({
    id: row.Title,
    brand: row.Marca,
    type: row.Tipo,
    model: row.Modelo,
    active: row.Activo === "1"
  }))
  .filter((item) => item.active && item.brand && item.model);
