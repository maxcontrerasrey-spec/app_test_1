import { afterEach, describe, expect, it } from "vitest";

import {
  BASE_REGISTER_DRAFT_VERSION,
  getBaseRegisterDraftKey,
  readBaseRegisterDraft,
} from "../../src/modules/operaciones/lib/operacionesDashboardConfig";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const originalWindow = globalThis.window;

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

describe("operations draft privacy", () => {
  it("purges legacy drafts that persisted driver PII", () => {
    const localStorage = new MemoryStorage();
    localStorage.setItem(
      "operations:base-register:draft:v1:previous-user",
      JSON.stringify({ driverDirectory: { "123": { fullName: "Persona", documentNumber: "1-9" } } })
    );
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage },
    });

    expect(readBaseRegisterDraft("current-user")).toBeNull();
    expect(localStorage.getItem("operations:base-register:draft:v1:previous-user")).toBeNull();
  });

  it("hydrates the current draft contract without a driver directory", () => {
    const localStorage = new MemoryStorage();
    const userId = "current-user";
    localStorage.setItem(
      getBaseRegisterDraftKey(userId),
      JSON.stringify({
        version: BASE_REGISTER_DRAFT_VERSION,
        userId,
        selectedContract: "CONT-028",
        selectedShift: "AM",
        selectedDateValue: "2026-08-03",
        serviceDrafts: {},
        updatedAt: Date.now(),
      })
    );
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage },
    });

    expect(readBaseRegisterDraft(userId)).toEqual({
      version: BASE_REGISTER_DRAFT_VERSION,
      userId,
      selectedContract: "CONT-028",
      selectedShift: "AM",
      selectedDateValue: "2026-08-03",
      serviceDrafts: {},
      updatedAt: expect.any(Number),
    });
  });
});
