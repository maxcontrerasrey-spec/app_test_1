import type { ServiceDataRecord } from "../data/services-data";

export interface Driver {
  id: string;
  fullName: string;
  documentNumber: string;
  areaName: string;
  areaCode: string;
  documentType?: string;
  jobTitle?: string;
  contractCode?: string | null;
  displayLabel?: string;
  rosterBaseStatus?: string | null;
  rosterEffectiveStatus?: string | null;
  isWorkingDay?: boolean;
  isRestDay?: boolean;
  isActive: boolean;
}

export interface Equipment {
  code: string;
  plate: string;
  type: string;
  currentClient: string;
  brand?: string;
  model?: string;
  year?: string;
  isActive?: boolean;
}

export interface ServiceDraft {
  driverId: string;
  equipmentCode: string;
}

export interface ContractSummary {
  contractCode: string;
  plannedServices: number;
  expectedServices: number;
  inTurnWorkers: number;
  outOfTurnWorkers: number;
  completionRate: number;
}

export interface DashboardSummary {
  byContract: ContractSummary[];
  totalPlanned: number;
  totalExpected: number;
  totalInTurn: number;
  totalOutOfTurn: number;
}

export interface OperationsServiceRecord extends ServiceDataRecord {
  normalizedSchedule: string;
}

export interface EmployeeActiveRow {
  buk_employee_id: string;
  full_name: string;
  document_number: string | null;
  document_type: string | null;
  area_name: string | null;
  area_code: string | null;
  is_active: boolean | null;
  status: string | null;
  updated_at: string | null;
}

export interface EquipmentDirectoryRow {
  equipment_code: string;
  plate: string | null;
  equipment_type: string | null;
  current_client: string | null;
  brand: string | null;
  model: string | null;
  year: string | number | null;
  is_active: boolean | null;
  updated_at: string | null;
}

export interface BaseServiceQueryRow {
  external_key: number | string;
  operational_name: string;
  company_name: string;
  service_type: string;
  contractual_name: string;
  contractual_category: string;
  schedule_label: string;
  contract_id: number | string | null;
  contracts: Array<{
    code: string | null;
    contract_name: string | null;
  }> | null;
}

export interface UserContractQueryRow {
  contracts: Array<{
    code: string | null;
    contract_name: string | null;
  }> | null;
}

export interface DashboardEntryRow {
  contract_code: string | null;
  service_date: string;
  shift: string | null;
  driver_name: string | null;
  driver_shift_status: string | null;
  service_operational_name: string | null;
}

export interface ExportEntryRow {
  service_date: string;
  shift: string | null;
  contract_code: string | null;
  service_operational_name: string | null;
  service_contractual_name: string | null;
  service_category: string | null;
  service_company: string | null;
  driver_name: string | null;
  driver_document: string | null;
  driver_area: string | null;
  driver_shift_status: string | null;
  equipment_code: string | null;
  equipment_plate: string | null;
  equipment_type: string | null;
  equipment_client: string | null;
  created_at: string | null;
}

export interface PendingServiceSubmission {
  serviceId: number;
  payload: {
    contractCode: string;
    shift: string;
    serviceDate: string;
    serviceExternalKey: number;
    driverName: string;
    driverDocument: string;
    driverArea: string;
    equipmentCode: string;
  };
}
