import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const templateDataPath = path.join(
  repoRoot,
  "src/modules/recruitment/lib/bukEmployeeTemplateData.json"
);
const templateData = JSON.parse(fs.readFileSync(templateDataPath, "utf8"));

const employeeHeaders = templateData.headers;
const bukOptionLists = templateData.optionLists;

const folioHeaders = [
  "folio_externo",
  "fecha_solicitud_original",
  "fecha_ingreso_solicitada",
  "solicitante_nombre",
  "solicitante_correo",
  "cargo",
  "contrato_buk",
  "centro_costo_codigo",
  "centro_costo_nombre",
  "vacantes",
  "fecha_inicio_contrato",
  "fecha_fin_contrato",
  "turno",
  "renta_liquida_ofrecida",
  "campamento",
  "pasajes",
  "metodologia_pasajes",
  "otros_beneficios",
  "estado_folio_actual",
  "comentario_folio"
];

const caseHeaders = [
  "case_code_externo",
  "folio_externo",
  "estado_caso_actual",
  "vacantes_solicitadas",
  "vacantes_cubiertas",
  "owner_nombre",
  "owner_correo",
  "fecha_apertura_caso",
  "fecha_objetivo_cierre",
  "comentario_caso"
];

const candidateHeaders = [
  "case_code_externo",
  "rut_candidato",
  "nombre_completo",
  "correo",
  "telefono",
  "etapa_actual",
  "fecha_ingreso_etapa",
  "suitability_status",
  "seleccionado",
  "tiene_hallazgos_who",
  "who_status",
  "who_fecha_solicitud",
  "who_resumen_causas",
  "who_comentario_solicitud",
  "who_aprobado_por",
  "who_fecha_aprobacion",
  "validacion_documental_status",
  "validado_documentalmente_por",
  "fecha_validacion_documental",
  "fecha_contratado",
  "observaciones_candidato"
];

const candidateBukHeaders = ["case_code_externo", "rut_candidato", ...employeeHeaders];

const documentRows = [
  ["Curriculum", "otros", "si"],
  ["Curriculum", "conductor", "si"],
  ["Certificado de Antecedentes", "otros", "si"],
  ["Certificado de Antecedentes", "conductor", "si"],
  ["Cedula de identidad", "otros", "si"],
  ["Cedula de identidad", "conductor", "si"],
  ["Certificado de estudios", "otros", "no"],
  ["Certificado de estudios", "conductor", "no"],
  ["Finiquito ultimo trabajo", "otros", "no"],
  ["Finiquito ultimo trabajo", "conductor", "no"],
  ["Certificado de AFP", "otros", "si"],
  ["Certificado de AFP", "conductor", "si"],
  ["Certificado de Organismo de salud", "otros", "no"],
  ["Certificado de Organismo de salud", "conductor", "no"],
  ["Certificado de miembro activo de Bomberos de Chile", "otros", "no"],
  ["Certificado de miembro activo de Bomberos de Chile", "conductor", "no"],
  ["Certificado de Residencia", "otros", "si"],
  ["Certificado de Residencia", "conductor", "si"],
  ["Licencia de conducir", "otros", "no"],
  ["Licencia de conducir", "conductor", "si"],
  ["Hoja de vida del conductor", "otros", "no"],
  ["Hoja de vida del conductor", "conductor", "si"],
  ["Examen de Drogas", "otros", "si"],
  ["Examen de Drogas", "conductor", "si"],
  ["Examen Teorico de Instructor", "otros", "no"],
  ["Examen Teorico de Instructor", "conductor", "si"],
  ["Examen Practico de Instructor", "otros", "no"],
  ["Examen Practico de Instructor", "conductor", "si"],
  ["Informe Evaluacion Psicolaboral", "otros", "si"],
  ["Informe Evaluacion Psicolaboral", "conductor", "si"],
  ["Examen Preocupacional", "otros", "no"],
  ["Examen Preocupacional", "conductor", "si"],
  ["Psicosensotecnico", "otros", "no"],
  ["Psicosensotecnico", "conductor", "si"]
];

const documentSheetHeaders = [
  "case_code_externo",
  "rut_candidato",
  "documento",
  "aplica_a",
  "obligatorio_según_regla",
  "status_documento",
  "fecha_vencimiento",
  "referencia_archivo",
  "observaciones_documento"
];

const migrationCatalogs = {
  estado_folio_actual: [
    "pending_area_manager",
    "pending_contracts_control",
    "approved",
    "rejected",
    "closed"
  ],
  estado_caso_actual: [
    "open",
    "sourcing",
    "screening",
    "ready_to_hire",
    "partially_filled",
    "filled",
    "closed_unfilled",
    "cancelled"
  ],
  etapa_actual: [
    "lead",
    "who_pending",
    "who_approved",
    "medical_exams",
    "document_review",
    "ready_for_hire",
    "hired",
    "rejected",
    "withdrawn"
  ],
  suitability_status: ["unknown", "fit", "risk", "blocked"],
  seleccion_bool: ["si", "no"],
  hallazgos_who_bool: ["si", "no"],
  who_status: ["", "pending", "approved", "rejected", "cancelled", "auto_clear"],
  validacion_documental_status: ["", "pending", "approved"],
  campamento_pasajes_bool: ["si", "no"],
  status_documento: ["pending", "uploaded", "approved", "rejected", "expired", "not_applicable"]
};

const instructionsRows = [
  ["Hoja", "Campo / regla", "Detalle"],
  [
    "General",
    "Objetivo",
    "Esta plantilla sirve para migrar folios ya en proceso al modulo productivo de reclutamiento sin perder trazabilidad."
  ],
  [
    "General",
    "Fecha original",
    "La columna fecha_solicitud_original en la hoja Folios se debe completar siempre. Esa es la referencia para respetar la fecha original de solicitud."
  ],
  [
    "General",
    "Llaves de enlace",
    "folio_externo enlaza Folios con Casos. case_code_externo enlaza Casos con Candidatos, Ficha_BUK y Documentos."
  ],
  [
    "General",
    "RUT candidato",
    "rut_candidato debe venir con el mismo valor en Candidatos, Ficha_BUK y Documentos para consolidar la carga."
  ],
  [
    "Folios",
    "Una fila por folio",
    "Usa un identificador estable en folio_externo. Si ya existe un folio historico, cargalo ahi."
  ],
  [
    "Folios",
    "Estado",
    "estado_folio_actual debe usar solo valores de la hoja Catalogos_Migracion."
  ],
  [
    "Casos",
    "Una fila por caso operativo",
    "Normalmente sera un caso por folio. Si el folio tiene caso activo, completa esta hoja."
  ],
  [
    "Candidatos",
    "Una fila por postulacion",
    "Si un candidato participo en mas de un caso, debe repetirse una fila por cada case_code_externo."
  ],
  [
    "Candidatos",
    "WHO",
    "Si tiene_hallazgos_who = no, who_status puede quedar vacio o usar auto_clear. Si tiene hallazgos, completa resumen, fechas y estado."
  ],
  [
    "Ficha_BUK",
    "Solo si ya existe ficha",
    "Completa esta hoja para candidatos con ficha personal/laboral disponible. Los encabezados replican la plantilla BUK usada por RRHH."
  ],
  [
    "Documentos",
    "Estado documental",
    "Esta hoja migra estado y referencia documental. Los archivos fisicos no viajan en el Excel; si falta algun PDF/imagen se cargara manualmente despues."
  ],
  [
    "Documentos",
    "Matriz vigente",
    "Los documentos base ya vienen precargados en la hoja como referencia de obligatoriedad para otros vs conductor."
  ]
];

const dictionaryRows = [
  ["hoja", "columna", "requerido", "descripcion"],
  ...buildDictionaryRows("Folios", folioHeaders, {
    folio_externo: ["si", "Identificador de negocio para enlazar el resto de hojas."],
    fecha_solicitud_original: ["si", "Fecha original de solicitud que se debe preservar."],
    fecha_ingreso_solicitada: ["si", "Fecha pedida para ingreso del trabajador."],
    solicitante_nombre: ["si", "Nombre del solicitante del folio."],
    solicitante_correo: ["no", "Correo del solicitante."],
    cargo: ["si", "Cargo solicitado."],
    contrato_buk: ["si", "Nombre del area/contrato segun BUK."],
    centro_costo_codigo: ["no", "Codigo contable del centro de costo si ya existe."],
    centro_costo_nombre: ["no", "Nombre contable del centro de costo."],
    vacantes: ["si", "Cantidad de vacantes pedidas."],
    fecha_inicio_contrato: ["no", "Inicio proyectado del contrato."],
    fecha_fin_contrato: ["no", "Termino proyectado del contrato."],
    turno: ["no", "Turno o jornada."],
    renta_liquida_ofrecida: ["no", "Monto liquido ofrecido."],
    campamento: ["no", "si/no."],
    pasajes: ["no", "si/no."],
    metodologia_pasajes: ["no", "Valor solo si pasajes = si."],
    otros_beneficios: ["no", "Texto libre."],
    estado_folio_actual: ["si", "Estado actual del folio."],
    comentario_folio: ["no", "Observacion relevante para migracion."]
  }),
  ...buildDictionaryRows("Casos", caseHeaders, {
    case_code_externo: ["si", "Identificador del caso para enlazar candidatos y fichas."],
    folio_externo: ["si", "Debe existir en hoja Folios."],
    estado_caso_actual: ["si", "Estado del caso operativo actual."],
    vacantes_solicitadas: ["si", "Vacantes abiertas en el caso."],
    vacantes_cubiertas: ["no", "Vacantes ya cubiertas."],
    owner_nombre: ["no", "Responsable actual del caso."],
    owner_correo: ["no", "Correo del owner si aplica."],
    fecha_apertura_caso: ["no", "Fecha en que el caso empezo a operarse."],
    fecha_objetivo_cierre: ["no", "Fecha objetivo de cierre."],
    comentario_caso: ["no", "Contexto adicional."]
  }),
  ...buildDictionaryRows("Candidatos", candidateHeaders, {
    case_code_externo: ["si", "Debe existir en hoja Casos."],
    rut_candidato: ["si", "RUT del candidato."],
    nombre_completo: ["si", "Nombre completo visible."],
    correo: ["no", "Correo del candidato."],
    telefono: ["no", "Telefono del candidato."],
    etapa_actual: ["si", "Etapa actual del pipeline."],
    fecha_ingreso_etapa: ["no", "Fecha de entrada a la etapa actual."],
    suitability_status: ["no", "unknown/fit/risk/blocked."],
    seleccionado: ["no", "si/no."],
    tiene_hallazgos_who: ["no", "si/no."],
    who_status: ["no", "Estado de aprobacion WHO si existe."],
    who_fecha_solicitud: ["no", "Fecha de solicitud WHO."],
    who_resumen_causas: ["no", "Resumen de causas judiciales en texto estructurado."],
    who_comentario_solicitud: ["no", "Comentario de envio a WHO."],
    who_aprobado_por: ["no", "Nombre de quien aprobo WHO."],
    who_fecha_aprobacion: ["no", "Fecha de aprobacion/rechazo WHO."],
    validacion_documental_status: ["no", "pending/approved."],
    validado_documentalmente_por: ["no", "Nombre del revisor documental."],
    fecha_validacion_documental: ["no", "Fecha de validacion documental."],
    fecha_contratado: ["no", "Solo si el candidato ya esta contratado."],
    observaciones_candidato: ["no", "Texto libre."]
  }),
  ["Ficha_BUK", "case_code_externo", "si", "Debe existir en hoja Casos."],
  ["Ficha_BUK", "rut_candidato", "si", "Debe existir en hoja Candidatos."],
  ["Ficha_BUK", "resto de columnas", "segun disponibilidad", "Replica exacta de la ficha BUK/nomina usada hoy por RRHH."],
  ...buildDictionaryRows("Documentos", documentSheetHeaders, {
    case_code_externo: ["si", "Debe existir en hoja Casos."],
    rut_candidato: ["si", "Debe existir en hoja Candidatos."],
    documento: ["si", "Nombre del documento segun matriz."],
    aplica_a: ["si", "otros o conductor."],
    obligatorio_según_regla: ["si", "si/no segun matriz vigente."],
    status_documento: ["si", "Estado actual del documento."],
    fecha_vencimiento: ["no", "Si aplica."],
    referencia_archivo: ["no", "Nombre o ruta de respaldo del archivo original."],
    observaciones_documento: ["no", "Texto libre."]
  })
];

function buildDictionaryRows(sheetName, headers, meta) {
  return headers.map((header) => [
    sheetName,
    header,
    meta[header]?.[0] ?? "no",
    meta[header]?.[1] ?? ""
  ]);
}

function escapeMarkdown(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, "<br />")
    .replace(/\|/g, "\\|")
    .trim();
}

function formatValue(value) {
  if (value === "") {
    return "`(vacio)`";
  }

  return `\`${escapeMarkdown(value)}\``;
}

function rowsToMarkdownTable(headers, rows) {
  const headerRow = `| ${headers.map((header) => escapeMarkdown(header)).join(" | ")} |`;
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyRows = rows.map(
    (row) => `| ${row.map((cell) => escapeMarkdown(cell)).join(" | ")} |`
  );

  return [headerRow, separatorRow, ...bodyRows].join("\n");
}

function renderHeaderSection(title, description, headers) {
  return [
    `## ${title}`,
    "",
    description,
    "",
    headers.map((header) => `- \`${header}\``).join("\n")
  ].join("\n");
}

function renderInstructionsSection() {
  const [, ...rows] = instructionsRows;

  return [
    "## Instrucciones",
    "",
    rowsToMarkdownTable(["Hoja", "Campo / regla", "Detalle"], rows)
  ].join("\n");
}

function renderDictionarySection() {
  const [headers, ...rows] = dictionaryRows;

  return [
    "## Diccionario",
    "",
    rowsToMarkdownTable(headers, rows)
  ].join("\n");
}

function renderDocumentMatrixSection() {
  return [
    "## Matriz documental base",
    "",
    rowsToMarkdownTable(["Documento", "Aplica a", "Obligatorio"], documentRows)
  ].join("\n");
}

function renderCatalogsSection() {
  const rows = Object.entries(migrationCatalogs).map(([field, values]) => [
    field,
    values.map((value) => formatValue(value)).join(", ")
  ]);

  return [
    "## Catalogos de migracion",
    "",
    rowsToMarkdownTable(["Campo", "Valores permitidos"], rows)
  ].join("\n");
}

function renderBukListsSection() {
  const sections = Object.entries(bukOptionLists).map(([field, values]) =>
    [
      `### ${field}`,
      "",
      values.map((value) => `- ${formatValue(value)}`).join("\n")
    ].join("\n")
  );

  return [
    "## Listas BUK",
    "",
    "Las opciones siguientes salen del mismo contrato vivo que usa el ERP para la ficha de `Personal a Contratar`.",
    "",
    ...sections
  ].join("\n");
}

function buildMarkdownDocument() {
  return [
    "# Plantilla de migracion de reclutamiento",
    "",
    "Este documento reemplaza la antigua plantilla Excel del repositorio. Mantiene el contrato funcional de migracion en un formato auditable, legible y versionable en texto.",
    "",
    "## Origen",
    "",
    "- Generado desde `scripts/generate-recruitment-migration-template.mjs`.",
    "- Reutiliza los encabezados y listas BUK definidos en `src/modules/recruitment/lib/bukEmployeeTemplateData.json`.",
    "- La relacion entre hojas se mantiene por `folio_externo`, `case_code_externo` y `rut_candidato`.",
    "",
    renderInstructionsSection(),
    "",
    renderHeaderSection(
      "Folios",
      "Una fila por folio operativo. Preserva la fecha original de solicitud y el estado vigente del folio.",
      folioHeaders
    ),
    "",
    renderHeaderSection(
      "Casos",
      "Una fila por caso operativo asociado al folio.",
      caseHeaders
    ),
    "",
    renderHeaderSection(
      "Candidatos",
      "Una fila por postulacion dentro del caso.",
      candidateHeaders
    ),
    "",
    renderHeaderSection(
      "Ficha BUK",
      "Replica exacta de la ficha personal/laboral usada para personal a contratar.",
      candidateBukHeaders
    ),
    "",
    renderHeaderSection(
      "Documentos",
      "Estado documental y referencias de respaldo por candidato.",
      documentSheetHeaders
    ),
    "",
    renderDocumentMatrixSection(),
    "",
    renderCatalogsSection(),
    "",
    renderDictionarySection(),
    "",
    renderBukListsSection(),
    ""
  ].join("\n");
}

function main() {
  const outputDir = path.join(repoRoot, "docs", "templates");
  fs.mkdirSync(outputDir, { recursive: true });

  const outputMarkdownPath = path.join(outputDir, "plantilla_migracion_reclutamiento.md");
  fs.writeFileSync(outputMarkdownPath, buildMarkdownDocument(), "utf8");

  process.stdout.write(`${outputMarkdownPath}\n`);
}

main();
