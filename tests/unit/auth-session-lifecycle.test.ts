import { describe, expect, it, vi } from "vitest";
import {
  clearSensitiveLocalStateForUser,
  didSessionIdentityChange,
  isCurrentAuthorizationLoad,
  resetSessionScopedQueries
} from "../../src/modules/auth/lib/authSessionLifecycle";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

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

  it("elimina borradores operacionales sensibles al cerrar la sesion", () => {
    const localStorage = new MemoryStorage();
    localStorage.setItem("operations:base-register:draft:v2:user-a", "sensitive");
    localStorage.setItem("operations:base-register:draft:v2:user-b", "preserve");
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage }
    });

    try {
      clearSensitiveLocalStateForUser("user-a");
      expect(localStorage.getItem("operations:base-register:draft:v2:user-a")).toBeNull();
      expect(localStorage.getItem("operations:base-register:draft:v2:user-b")).toBe("preserve");
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow
      });
    }
  });
});
