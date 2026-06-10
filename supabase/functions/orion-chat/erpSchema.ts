export type OrionReadableTableConfig = {
  description: string;
  columns: readonly string[];
  defaultColumns: readonly string[];
  searchableColumns: readonly string[];
  exactMatchColumns?: readonly string[];
  orderBy?: {
    column: string;
    ascending?: boolean;
  };
  maxLimit?: number;
};

const recruitmentTables = {
  hiring_requests: {
    description: "Folios de solicitud de contratación y su estado general.",
    columns: [
      "id",
      "folio",
      "status",
      "requester_name",
      "requester_email",
      "job_position_name",
      "cost_center_code",
      "cost_center_name",
      "contract_name",
      "requested_start_date",
      "headcount_requested",
      "created_at",
      "updated_at"
    ],
    defaultColumns: [
      "folio",
      "status",
      "job_position_name",
      "contract_name",
      "requested_start_date",
      "headcount_requested"
    ],
    searchableColumns: ["folio", "job_position_name", "contract_name", "requester_name"],
    exactMatchColumns: ["id", "folio"],
    orderBy: { column: "created_at", ascending: false },
    maxLimit: 25
  },
  hiring_request_approvals: {
    description: "Aprobaciones y decisiones de folios de contratación.",
    columns: [
      "id",
      "hiring_request_id",
      "step_code",
      "step_name",
      "approver_name",
      "approver_user_id",
      "status",
      "decision",
      "comment",
      "travel_methodology",
      "acted_at",
      "created_at"
    ],
    defaultColumns: [
      "hiring_request_id",
      "step_code",
      "step_name",
      "approver_name",
      "status",
      "decision",
      "acted_at"
    ],
    searchableColumns: ["step_code", "step_name", "approver_name", "comment"],
    exactMatchColumns: ["id", "hiring_request_id"],
    orderBy: { column: "created_at", ascending: false },
    maxLimit: 30
  },
  recruitment_cases: {
    description: "Casos operativos de reclutamiento abiertos desde folios aprobados.",
    columns: [
      "id",
      "code",
      "title",
      "status",
      "hiring_request_id",
      "contract_name",
      "job_position_name",
      "requested_vacancies",
      "filled_vacancies",
      "owner_name",
      "created_at",
      "updated_at"
    ],
    defaultColumns: [
      "code",
      "title",
      "status",
      "contract_name",
      "job_position_name",
      "requested_vacancies",
      "filled_vacancies",
      "owner_name"
    ],
    searchableColumns: ["code", "title", "contract_name", "job_position_name", "owner_name"],
    exactMatchColumns: ["id", "code", "hiring_request_id"],
    orderBy: { column: "created_at", ascending: false },
    maxLimit: 25
  },
  recruitment_case_candidates: {
    description: "Participación de candidatos dentro de cada caso y su etapa.",
    columns: [
      "id",
      "recruitment_case_id",
      "candidate_profile_id",
      "stage_code",
      "suitability_status",
      "is_selected",
      "who_approval_status",
      "who_requested_by_name",
      "who_requested_at",
      "who_approved_by_name",
      "who_approved_at",
      "document_validation_status",
      "document_validated_by_name",
      "document_validated_at",
      "hired_at",
      "created_at",
      "updated_at"
    ],
    defaultColumns: [
      "recruitment_case_id",
      "candidate_profile_id",
      "stage_code",
      "suitability_status",
      "is_selected",
      "who_approval_status",
      "document_validation_status",
      "hired_at"
    ],
    searchableColumns: ["stage_code", "suitability_status", "who_approval_status", "document_validation_status"],
    exactMatchColumns: ["id", "recruitment_case_id", "candidate_profile_id"],
    orderBy: { column: "updated_at", ascending: false },
    maxLimit: 30
  },
  candidate_profiles: {
    description: "Perfil base del candidato.",
    columns: [
      "id",
      "full_name",
      "national_id",
      "email",
      "phone",
      "created_at",
      "updated_at"
    ],
    defaultColumns: ["full_name", "national_id", "email", "phone", "updated_at"],
    searchableColumns: ["full_name", "national_id", "email", "phone"],
    exactMatchColumns: ["id", "national_id"],
    orderBy: { column: "updated_at", ascending: false },
    maxLimit: 20
  },
  candidate_stage_approvals: {
    description: "Aprobaciones pendientes o resueltas de etapas especiales como Who.",
    columns: [
      "id",
      "case_candidate_id",
      "approval_type",
      "status",
      "requested_by_name",
      "requested_at",
      "approved_by_name",
      "approved_at",
      "request_comment",
      "approval_comment",
      "created_at",
      "updated_at"
    ],
    defaultColumns: [
      "case_candidate_id",
      "approval_type",
      "status",
      "requested_by_name",
      "requested_at",
      "approved_by_name",
      "approved_at"
    ],
    searchableColumns: ["approval_type", "status", "requested_by_name", "approved_by_name", "request_comment", "approval_comment"],
    exactMatchColumns: ["id", "case_candidate_id"],
    orderBy: { column: "updated_at", ascending: false },
    maxLimit: 30
  },
  candidate_documents: {
    description: "Documentación cargada por candidato.",
    columns: [
      "id",
      "case_candidate_id",
      "document_type_id",
      "file_path",
      "status",
      "expires_at",
      "uploaded_at",
      "created_at",
      "updated_at"
    ],
    defaultColumns: [
      "case_candidate_id",
      "document_type_id",
      "status",
      "expires_at",
      "uploaded_at"
    ],
    searchableColumns: ["status", "file_path"],
    exactMatchColumns: ["id", "case_candidate_id", "document_type_id"],
    orderBy: { column: "uploaded_at", ascending: false },
    maxLimit: 30
  },
  candidate_worker_files: {
    description: "Ficha contractual/laboral que se exporta a RRHH para contratación.",
    columns: [
      "id",
      "case_candidate_id",
      "employee_code",
      "project_name",
      "company_entry_date",
      "shift_name",
      "private_role",
      "payment_method",
      "pension_regime",
      "health_provider",
      "afc_regime",
      "retirement_regime",
      "created_at",
      "updated_at"
    ],
    defaultColumns: [
      "case_candidate_id",
      "employee_code",
      "project_name",
      "company_entry_date",
      "shift_name",
      "private_role",
      "payment_method"
    ],
    searchableColumns: ["employee_code", "project_name", "shift_name", "private_role", "payment_method"],
    exactMatchColumns: ["id", "case_candidate_id", "employee_code"],
    orderBy: { column: "updated_at", ascending: false },
    maxLimit: 20
  },
  document_types: {
    description: "Catálogo documental de reclutamiento y control documental.",
    columns: [
      "id",
      "code",
      "name",
      "applies_to",
      "is_required",
      "sort_order",
      "is_active"
    ],
    defaultColumns: ["code", "name", "applies_to", "is_required", "sort_order", "is_active"],
    searchableColumns: ["code", "name", "applies_to"],
    exactMatchColumns: ["id", "code"],
    orderBy: { column: "sort_order", ascending: true },
    maxLimit: 50
  }
} as const satisfies Record<string, OrionReadableTableConfig>;

const hrTables = {
  employees: {
    description: "Sync interna de BUK con trabajadores activos e históricos.",
    columns: [
      "id",
      "buk_employee_id",
      "full_name",
      "national_id",
      "status",
      "job_title",
      "area_name",
      "contract_name",
      "union_name",
      "active_since",
      "active_until",
      "updated_at"
    ],
    defaultColumns: [
      "buk_employee_id",
      "full_name",
      "national_id",
      "status",
      "job_title",
      "area_name",
      "contract_name",
      "union_name",
      "active_until"
    ],
    searchableColumns: ["buk_employee_id", "full_name", "national_id", "job_title", "area_name", "contract_name", "union_name"],
    exactMatchColumns: ["id", "buk_employee_id", "national_id"],
    orderBy: { column: "updated_at", ascending: false },
    maxLimit: 25
  },
  hr_incentive_requests: {
    description: "Solicitudes de incentivos extraordinarios de RRHH.",
    columns: [
      "id",
      "buk_employee_id",
      "worker_name",
      "worker_rut",
      "selected_contract_code",
      "selected_area_name",
      "incentive_type_name",
      "status",
      "calculated_amount",
      "service_date",
      "created_at",
      "updated_at"
    ],
    defaultColumns: [
      "buk_employee_id",
      "worker_name",
      "worker_rut",
      "selected_area_name",
      "incentive_type_name",
      "status",
      "calculated_amount",
      "service_date"
    ],
    searchableColumns: ["buk_employee_id", "worker_name", "worker_rut", "selected_area_name", "incentive_type_name", "status"],
    exactMatchColumns: ["id", "buk_employee_id", "worker_rut"],
    orderBy: { column: "created_at", ascending: false },
    maxLimit: 25
  },
  hr_incentive_request_history: {
    description: "Historial de cambios y aprobaciones de incentivos.",
    columns: [
      "id",
      "request_id",
      "action",
      "actor_name",
      "comment",
      "created_at"
    ],
    defaultColumns: ["request_id", "action", "actor_name", "comment", "created_at"],
    searchableColumns: ["action", "actor_name", "comment"],
    exactMatchColumns: ["id", "request_id"],
    orderBy: { column: "created_at", ascending: false },
    maxLimit: 30
  },
  hr_incentive_types: {
    description: "Catálogo de tipos de incentivo disponibles.",
    columns: [
      "id",
      "code",
      "name",
      "calculation_basis",
      "requires_replacement",
      "is_active",
      "created_at",
      "updated_at"
    ],
    defaultColumns: ["code", "name", "calculation_basis", "requires_replacement", "is_active"],
    searchableColumns: ["code", "name", "calculation_basis"],
    exactMatchColumns: ["id", "code"],
    orderBy: { column: "name", ascending: true },
    maxLimit: 30
  },
  hr_incentive_rate_rules: {
    description: "Reglas de cálculo monetario para incentivos.",
    columns: [
      "id",
      "incentive_type_id",
      "contract_code",
      "job_title",
      "union_name",
      "union_status",
      "amount",
      "priority",
      "valid_from",
      "valid_to",
      "is_active",
      "created_at",
      "updated_at"
    ],
    defaultColumns: [
      "incentive_type_id",
      "contract_code",
      "job_title",
      "union_name",
      "union_status",
      "amount",
      "priority",
      "valid_from",
      "valid_to",
      "is_active"
    ],
    searchableColumns: ["contract_code", "job_title", "union_name", "union_status"],
    exactMatchColumns: ["id", "incentive_type_id", "contract_code"],
    orderBy: { column: "priority", ascending: true },
    maxLimit: 30
  },
  buk_contract_mappings: {
    description: "Equivalencia entre áreas/contratos BUK y la vista contable interna.",
    columns: [
      "id",
      "buk_area_name",
      "contract_code",
      "contract_name",
      "cost_center_code",
      "cost_center_name",
      "is_active",
      "created_at",
      "updated_at"
    ],
    defaultColumns: [
      "buk_area_name",
      "contract_code",
      "contract_name",
      "cost_center_code",
      "cost_center_name",
      "is_active"
    ],
    searchableColumns: ["buk_area_name", "contract_code", "contract_name", "cost_center_code", "cost_center_name"],
    exactMatchColumns: ["id", "contract_code", "cost_center_code"],
    orderBy: { column: "contract_name", ascending: true },
    maxLimit: 40
  }
} as const satisfies Record<string, OrionReadableTableConfig>;

const catalogTables = {
  contracts: {
    description: "Catálogo maestro de contratos / centros de costo.",
    columns: [
      "id",
      "contract_code",
      "contract_name",
      "cost_center_code",
      "cost_center_name",
      "is_active",
      "created_at",
      "updated_at"
    ],
    defaultColumns: ["contract_code", "contract_name", "cost_center_code", "cost_center_name", "is_active"],
    searchableColumns: ["contract_code", "contract_name", "cost_center_code", "cost_center_name"],
    exactMatchColumns: ["id", "contract_code", "cost_center_code"],
    orderBy: { column: "contract_name", ascending: true },
    maxLimit: 40
  },
  job_positions: {
    description: "Catálogo de cargos usados por contratación y reclutamiento.",
    columns: [
      "id",
      "name",
      "category",
      "requires_driver_license",
      "is_active",
      "created_at",
      "updated_at"
    ],
    defaultColumns: ["name", "category", "requires_driver_license", "is_active"],
    searchableColumns: ["name", "category"],
    exactMatchColumns: ["id"],
    orderBy: { column: "name", ascending: true },
    maxLimit: 40
  },
  shifts: {
    description: "Catálogo de turnos operativos y de contratación.",
    columns: [
      "id",
      "name",
      "code",
      "description",
      "is_active",
      "created_at",
      "updated_at"
    ],
    defaultColumns: ["name", "code", "description", "is_active"],
    searchableColumns: ["name", "code", "description"],
    exactMatchColumns: ["id", "code"],
    orderBy: { column: "name", ascending: true },
    maxLimit: 30
  }
} as const satisfies Record<string, OrionReadableTableConfig>;

export const ORION_READABLE_TABLES = {
  ...recruitmentTables,
  ...hrTables,
  ...catalogTables
} as const satisfies Record<string, OrionReadableTableConfig>;

export type OrionReadableTableName = keyof typeof ORION_READABLE_TABLES;

export function buildOrionSchemaPrompt() {
  return Object.entries(ORION_READABLE_TABLES)
    .map(([tableName, config]) => {
      const columnList = config.columns.join(", ");
      const searchList = config.searchableColumns.join(", ");
      return `- ${tableName}: ${config.description} | columnas: ${columnList} | buscables: ${searchList}`;
    })
    .join("\n");
}
