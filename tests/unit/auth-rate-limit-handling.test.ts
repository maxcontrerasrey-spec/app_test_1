import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getPasswordResetErrorMessage,
  getSignInErrorMessage,
  isAuthRateLimitError,
  normalizeAuthOperationError
} from "../../src/modules/auth/lib/authErrors";

describe("auth rate limit handling", () => {
  it("preserva status y codigo estables de Supabase Auth", () => {
    const error = normalizeAuthOperationError({
      message: "email rate limit exceeded",
      code: "over_email_send_rate_limit",
      status: 429
    });

    expect(error).toEqual({
      message: "email rate limit exceeded",
      code: "over_email_send_rate_limit",
      status: 429
    });
    expect(isAuthRateLimitError(error)).toBe(true);
  });

  it("muestra mensajes operativos sin filtrar el error crudo", () => {
    const error = normalizeAuthOperationError({
      message: "email rate limit exceeded",
      code: "over_email_send_rate_limit",
      status: 429
    });

    expect(error).not.toBeNull();
    expect(getPasswordResetErrorMessage(error!)).not.toContain("rate limit");
    expect(getPasswordResetErrorMessage(error!)).toContain("No repitas");
    expect(getSignInErrorMessage(error!)).toContain("No sigas intentando");
  });

  it("bloquea doble envio y aplica cooldown en la pantalla de login", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/modules/auth/pages/LoginPage.tsx"),
      "utf8"
    );

    expect(source).toContain("authRequestInFlightRef.current");
    expect(source).toContain("PASSWORD_RESET_COOLDOWN_SECONDS");
    expect(source).toContain("resetCooldownSeconds > 0");
    expect(source).not.toMatch(/^\s*setErrorMessage\(\s*error\s*\);/m);
  });

  it("usa el broker transaccional y no el limite global de correos Auth", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/modules/auth/services/authApi.ts"),
      "utf8"
    );

    expect(source).toContain('supabase.functions.invoke("request-password-reset"');
    expect(source).not.toContain("resetPasswordForEmail");
  });
});
