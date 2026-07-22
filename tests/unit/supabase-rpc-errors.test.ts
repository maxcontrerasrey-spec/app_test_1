import { describe, expect, it } from "vitest";
import { formatSupabaseError, getSupabaseErrorMessage } from "../../src/shared/lib/supabaseRpc";

describe("Supabase RPC error formatting", () => {
  it("convierte errores de red en mensaje operacional sin stack", () => {
    expect(formatSupabaseError(new TypeError("Failed to fetch"))).toBe(
      "No fue posible conectar con Supabase. Revisa tu conexión e intenta nuevamente."
    );
  });

  it("elimina stack traces de detalles tecnicos antes de mostrar el error", () => {
    const message = formatSupabaseError({
      message: "No autorizado",
      details: "permission denied\n    at https://example.com/assets/app.js:10:20",
      hint: "Solicita acceso",
      code: "42501"
    });

    expect(message).toBe("No autorizado · Detalles: permission denied · Sugerencia: Solicita acceso · Código: 42501");
    expect(message).not.toContain("assets/app.js");
  });

  it("usa fallback cuando Supabase no entrega mensaje util", () => {
    expect(getSupabaseErrorMessage({}, "Error controlado", "plain")).toBe("Error controlado");
  });
});
