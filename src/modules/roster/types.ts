export type RosterExceptionType =
  | "vacation"
  | "medical_leave"
  | "absent"
  | "extra_shift"
  | "training"
  | "administrative_leave"
  | "union_leave";

export type RosterDayBaseStatus = "working" | "resting" | "unassigned";

export type RosterDayEffectiveStatus =
  | RosterDayBaseStatus
  | RosterExceptionType;

export type ShiftPattern = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  workingDays: number;
  restingDays: number;
  cycleLength: number;
  colorHex: string | null;
  isActive: boolean;
  createdAt: string;
};

export type RosterExceptionTypeOption = {
  value: RosterExceptionType;
  label: string;
};

export type RosterSetupCatalogs = {
  patterns: ShiftPattern[];
  exceptionTypes: RosterExceptionTypeOption[];
};

export type RosterWorkerSearchItem = {
  bukEmployeeId: string;
  fullName: string;
  documentNumber: string;
  documentType: string;
  jobTitle: string;
  contractCode: string | null;
  areaName: string | null;
  displayLabel: string;
};

export type WorkerRosterAssignment = {
  id: string;
  patternId: string;
  patternName: string;
  patternCode: string;
  workingDays: number;
  restingDays: number;
  cycleLength: number;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  contractCode: string | null;
  areaName: string | null;
  createdAt: string;
};

export type WorkerRosterException = {
  id: string;
  exceptionDate: string;
  exceptionType: RosterExceptionType;
  exceptionLabel: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

export type WorkerScheduleDay = {
  date: string;
  assignmentId: string | null;
  patternId: string | null;
  patternName: string | null;
  cycleDay: number | null;
  baseStatus: RosterDayBaseStatus;
  effectiveStatus: RosterDayEffectiveStatus;
  exceptionType: RosterExceptionType | null;
  exceptionLabel: string | null;
  exceptionNotes: string | null;
  isWorkingDay: boolean;
  isRestDay: boolean;
};

export type WorkerSchedulePayload = {
  worker: {
    bukEmployeeId: string;
    fullName: string;
    documentNumber: string;
    documentType: string;
    jobTitle: string;
    contractCode: string | null;
    areaName: string | null;
  };
  range: {
    startDate: string;
    endDate: string;
  };
  summary: {
    workingDays: number;
    restingDays: number;
    exceptionDays: number;
    unassignedDays: number;
  };
  assignments: WorkerRosterAssignment[];
  exceptions: WorkerRosterException[];
  days: WorkerScheduleDay[];
};
