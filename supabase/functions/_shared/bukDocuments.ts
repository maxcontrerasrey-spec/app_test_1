function requireEnv(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing ${label}`);
  }

  return normalized;
}

const DEFAULT_BUK_DOCUMENTS_PATH = "Postulación";
const BUK_DOCUMENT_UPLOAD_TIMEOUT_MS = 30_000;
const BUK_DOCUMENT_RECONCILIATION_TIMEOUT_MS = 15_000;

function normalizeDocumentsTemplate(template: string) {
  const trimmed = template.trim();

  if (!trimmed) {
    return trimmed;
  }

  return trimmed
    .replace(/\{employee_id\}/g, "{id}")
    .replace(/\/documents(?=\/?$|\?)/g, "/docs");
}

function resolveBukDocumentsPath(explicitPath?: string | null) {
  const normalizedExplicitPath = explicitPath?.trim();
  if (normalizedExplicitPath) {
    return normalizedExplicitPath;
  }

  const configuredPath = Deno.env.get("BUK_EMPLOYEE_DOCUMENTS_PATH");
  if (configuredPath == null) {
    return DEFAULT_BUK_DOCUMENTS_PATH;
  }

  const normalized = configuredPath.trim();
  return normalized.length > 0 ? normalized : null;
}

function blobToBase64(blob: Blob) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";

    for (let index = 0; index < bytes.length; index += 0x8000) {
      const chunk = bytes.subarray(index, index + 0x8000);
      binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
  });
}

function buildBase64Payload(fileName: string, fileBlob: Blob) {
  return blobToBase64(fileBlob).then((content) =>
    JSON.stringify({
      content,
      filename: fileName
    })
  );
}

async function parseBukResponse(response: Response) {
  const rawBody = await response.text();
  let payload: Record<string, unknown> | null = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      payload = { raw: rawBody };
    }
  }

  return { rawBody, payload };
}

function extractDocumentRows(payload: Record<string, unknown> | null) {
  if (!payload) return [] as Record<string, unknown>[];

  const candidates = [
    payload.data,
    payload.documents,
    payload.employee_files,
    payload.files,
    payload.items,
    payload.results,
    (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>).documents
      : null),
    (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>).employee_files
      : null),
    (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>).items
      : null)
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return candidate.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
    );
  }

  return [] as Record<string, unknown>[];
}

async function sendDocumentRequest(url: string, authToken: string, formData: FormData) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BUK_DOCUMENT_UPLOAD_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        auth_token: authToken
      },
      body: formData,
      signal: controller.signal
    });
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw new Error("Buk document upload timeout; el resultado remoto debe reconciliarse antes de reintentar");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const parsed = await parseBukResponse(response);
  return {
    response,
    ...parsed
  };
}

export function extractBukDocumentMetadata(payload: Record<string, unknown>) {
  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : null;
  const employeeFile =
    payload.employee_file && typeof payload.employee_file === "object"
      ? (payload.employee_file as Record<string, unknown>)
      : data?.employee_file && typeof data.employee_file === "object"
        ? (data.employee_file as Record<string, unknown>)
        : null;

  const documentId =
    employeeFile?.id ??
    employeeFile?.file_id ??
    data?.id ??
    data?.file_id ??
    payload.id ??
    payload.file_id ??
    payload.document_id ??
    null;
  const documentUrl =
    employeeFile?.url ??
    data?.url ??
    payload.url ??
    payload.document_url ??
    null;
  const folderId =
    employeeFile?.employee_folder_id ??
    employeeFile?.folder_id ??
    data?.employee_folder_id ??
    data?.folder_id ??
    payload.employee_folder_id ??
    payload.folder_id ??
    null;

  return {
    bukDocumentId: documentId ? String(documentId) : null,
    bukDocumentUrl: documentUrl ? String(documentUrl) : null,
    bukEmployeeFolderId: folderId != null ? String(folderId) : null
  };
}

export function buildBukBaseUrl() {
  return (Deno.env.get("BUK_EMPLOYEES_URL") ?? "https://busesjm.buk.cl/api/v1/chile/employees").trim();
}

export function buildBukDocumentsUrl(employeeId: string | number) {
  const employeeIdToken = encodeURIComponent(String(employeeId));
  const configuredTemplate = Deno.env.get("BUK_EMPLOYEE_DOCUMENTS_URL_TEMPLATE")?.trim();

  if (configuredTemplate) {
    const normalizedTemplate = normalizeDocumentsTemplate(configuredTemplate);
    if (normalizedTemplate.includes("{id}")) {
      return normalizedTemplate.replace(/\{id\}/g, employeeIdToken);
    }

    if (normalizedTemplate.endsWith("/employees")) {
      return `${normalizedTemplate}/${employeeIdToken}/docs`;
    }

    return `${normalizedTemplate.replace(/\/+$/, "")}/${employeeIdToken}/docs`;
  }

  return `${buildBukBaseUrl().replace(/\/+$/, "")}/${employeeIdToken}/docs`;
}

function appendBukDocumentsQuery(url: string, params: Record<string, string>) {
  const parsedUrl = new URL(url);

  for (const [key, value] of Object.entries(params)) {
    if (value.trim()) {
      parsedUrl.searchParams.set(key, value);
    }
  }

  return parsedUrl.toString();
}

function documentRowName(row: Record<string, unknown>) {
  const value =
    row.name ??
    row.filename ??
    row.file_name ??
    row.document_name ??
    row.title ??
    (row.file && typeof row.file === "object" && !Array.isArray(row.file)
      ? (row.file as Record<string, unknown>).name
      : null);
  return typeof value === "string" ? value.trim() : "";
}

function documentRowPath(row: Record<string, unknown>) {
  const value = row.folder ?? row.folder_name ?? row.category ?? null;
  return typeof value === "string" ? value.trim() : "";
}

async function listBukDocuments(employeeId: string, path: string | null) {
  const authToken = requireEnv(Deno.env.get("BUK_AUTH_TOKEN"), "BUK_AUTH_TOKEN");
  const url = appendBukDocumentsQuery(buildBukDocumentsUrl(employeeId), {
    ...(path ? { path } : {})
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BUK_DOCUMENT_RECONCILIATION_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        auth_token: authToken
      },
      signal: controller.signal
    });
    const parsed = await parseBukResponse(response);
    if (!response.ok) {
      throw new Error(`Buk document reconciliation failed (${response.status})`);
    }

    return extractDocumentRows(parsed.payload);
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw new Error("Buk document reconciliation timeout; no se pudo confirmar el estado remoto");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function reconcileBukDocumentUpload(
  employeeId: string,
  documentName: string,
  options: { path?: string | null } = {}
) {
  const targetPath = resolveBukDocumentsPath(options.path);
  const rows = await listBukDocuments(employeeId, targetPath);
  const normalizedName = documentName.trim().toLocaleLowerCase("es-CL");
  const match = rows.find((row) => {
    const name = documentRowName(row).toLocaleLowerCase("es-CL");
    const rowPath = documentRowPath(row).toLocaleLowerCase("es-CL");
    const expectedPath = (targetPath ?? "").trim().toLocaleLowerCase("es-CL");
    return name === normalizedName && (!expectedPath || !rowPath || rowPath === expectedPath);
  });

  if (!match) {
    return { found: false as const };
  }

  const metadata = extractBukDocumentMetadata(match);
  return {
    found: true as const,
    bukDocumentId: metadata.bukDocumentId,
    bukDocumentUrl: metadata.bukDocumentUrl,
    bukEmployeeFolderId: metadata.bukEmployeeFolderId,
    bukDocumentName: documentRowName(match) || documentName
  };
}

export async function uploadBukDocument(
  employeeId: string,
  documentName: string,
  fileBlob: Blob,
  options: { path?: string | null } = {}
) {
  const authToken = requireEnv(Deno.env.get("BUK_AUTH_TOKEN"), "BUK_AUTH_TOKEN");
  const targetPath = resolveBukDocumentsPath(options.path);
  const url = appendBukDocumentsQuery(buildBukDocumentsUrl(employeeId), {
    ...(targetPath ? { path: targetPath } : {})
  });

  const multipartFormData = new FormData();
  multipartFormData.append("file", fileBlob, documentName);
  multipartFormData.append("name", documentName);

  const primaryAttempt = await sendDocumentRequest(url, authToken, multipartFormData);
  if (primaryAttempt.response.ok) {
    return {
      transport: "file" as const,
      status: primaryAttempt.response.status,
      payload: primaryAttempt.payload ?? {}
    };
  }

  if (![400, 415, 422].includes(primaryAttempt.response.status)) {
    throw new Error(`Buk document upload failed (${primaryAttempt.response.status})`);
  }

  const base64FormData = new FormData();
  base64FormData.append(
    "file_base64",
    await buildBase64Payload(documentName, fileBlob)
  );
  base64FormData.append("name", documentName);

  const fallbackAttempt = await sendDocumentRequest(url, authToken, base64FormData);
  if (!fallbackAttempt.response.ok) {
    throw new Error(`Buk document upload failed (${fallbackAttempt.response.status})`);
  }

  return {
    transport: "file_base64" as const,
    status: fallbackAttempt.response.status,
    payload: fallbackAttempt.payload ?? {}
  };
}
