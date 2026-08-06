export type AuthOperationError = {
  message: string;
  code: string | null;
  status: number | null;
};

type AuthErrorLike = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
};

export function normalizeAuthOperationError(error: unknown): AuthOperationError | null {
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return { message: error, code: null, status: null };
  }

  const candidate = error as AuthErrorLike;
  return {
    message:
      typeof candidate.message === "string" && candidate.message.trim()
        ? candidate.message.trim()
        : "Error de autenticación.",
    code: typeof candidate.code === "string" ? candidate.code : null,
    status: typeof candidate.status === "number" ? candidate.status : null
  };
}

export function isAuthRateLimitError(error: AuthOperationError | null): boolean {
  return Boolean(
    error &&
      (error.status === 429 ||
        error.code === "over_email_send_rate_limit" ||
        error.code === "over_request_rate_limit")
  );
}

export function getSignInErrorMessage(error: AuthOperationError): string {
  if (isAuthRateLimitError(error)) {
    return "Se alcanzó temporalmente el límite de intentos. No sigas intentando y contacta a soporte para recuperar el acceso.";
  }

  return "No fue posible iniciar sesión. Revisa tus credenciales.";
}

export function getPasswordResetErrorMessage(error: AuthOperationError): string {
  if (isAuthRateLimitError(error)) {
    return "El servicio de recuperación está temporalmente ocupado. No repitas la solicitud; revisa tu correo y, si no recibiste el enlace, contacta a soporte.";
  }

  return "No fue posible solicitar la recuperación. Intenta nuevamente o contacta a soporte.";
}
