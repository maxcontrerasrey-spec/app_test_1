import {
  asRecord,
  getSupabaseClientOrThrow,
  getSupabaseErrorMessage,
  readBoolean,
  readNullableText,
  readText
} from "../../../shared/lib/supabaseRpc";

export type HiringDocumentPublicVerification = {
  found: boolean;
  isAuthentic: boolean;
  isCurrent: boolean;
  status: string;
  verifiedAt: string | null;
  document: {
    folio: string;
    templateCode: string;
    templateVersion: string;
    issuedAt: string | null;
    pdfSha256: string | null;
    bukRegistered: boolean;
    bukUploadedAt: string | null;
  };
  worker: {
    fullName: string;
    documentNumberMasked: string;
    jobTitle: string;
  };
  employment: {
    companyName: string;
    contractName: string;
  };
  validation: {
    fullName: string;
    jobTitle: string;
    validatedAt: string | null;
  };
};

function mapVerification(payload: unknown): HiringDocumentPublicVerification {
  const source = asRecord(payload);
  const document = asRecord(source.document);
  const worker = asRecord(source.worker);
  const employment = asRecord(source.employment);
  const validation = asRecord(source.validation);
  return {
    found: readBoolean(source.found),
    isAuthentic: readBoolean(source.is_authentic),
    isCurrent: readBoolean(source.is_current),
    status: readText(source.status),
    verifiedAt: readNullableText(source.verified_at),
    document: {
      folio: readText(document.folio),
      templateCode: readText(document.template_code),
      templateVersion: readText(document.template_version),
      issuedAt: readNullableText(document.issued_at),
      pdfSha256: readNullableText(document.pdf_sha256),
      bukRegistered: readBoolean(document.buk_registered),
      bukUploadedAt: readNullableText(document.buk_uploaded_at)
    },
    worker: {
      fullName: readText(worker.full_name),
      documentNumberMasked: readText(worker.document_number_masked),
      jobTitle: readText(worker.job_title)
    },
    employment: {
      companyName: readText(employment.company_name),
      contractName: readText(employment.contract_name)
    },
    validation: {
      fullName: readText(validation.full_name),
      jobTitle: readText(validation.job_title),
      validatedAt: readNullableText(validation.validated_at)
    }
  };
}

export async function verifyHiringDocument(lookup: string) {
  const client = getSupabaseClientOrThrow();
  const { data, error } = await client.functions.invoke("verify-hiring-document", {
    body: { lookup: lookup.trim() }
  });
  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible validar el documento.", "message"));
  }
  return mapVerification(data);
}
