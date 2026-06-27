export type BukEmployee = {
  bukEmployeeId: string;
  fullName: string;
  documentNumber: string;
  jobTitle: string;
  contractCode: string | null;
  areaName: string | null;
  displayLabel: string;
};

export type BukEmployeeWithCompany = BukEmployee & {
  companyName: string | null;
};

export type BukEmployeeWithDocumentType = BukEmployee & {
  documentType: string;
};
