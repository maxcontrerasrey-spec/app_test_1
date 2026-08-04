import { describe, expect, it, vi } from "vitest";
import {
  didSessionIdentityChange,
  isCurrentAuthorizationLoad,
  resetSessionScopedQueries
} from "../../src/modules/auth/lib/authSessionLifecycle";

describe("auth session lifecycle", () => {
  it("limpia datos de sesion solo cuando cambia la identidad", () => {
    expect(didSessionIdentityChange("user-a", "user-a")).toBe(false);
    expect(didSessionIdentityChange("user-a", "user-b")).toBe(true);
    expect(didSessionIdentityChange("user-a", null)).toBe(true);
    expect(didSessionIdentityChange(null, "user-a")).toBe(true);
  });

  it("cancela requests y limpia la cache compartida", () => {
    const cancelQueries = vi.fn().mockResolvedValue(undefined);
    const clear = vi.fn();

    resetSessionScopedQueries({ cancelQueries, clear });

    expect(cancelQueries).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
  });

  it("rechaza respuestas de autorizacion obsoletas o de otra identidad", () => {
    expect(isCurrentAuthorizationLoad(2, 2, "user-b", "user-b")).toBe(true);
    expect(isCurrentAuthorizationLoad(1, 2, "user-a", "user-b")).toBe(false);
    expect(isCurrentAuthorizationLoad(2, 2, "user-a", "user-b")).toBe(false);
  });
});
