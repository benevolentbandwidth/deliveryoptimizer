import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readUploadedRoute,
  UPLOADED_ROUTE_KEY,
} from "@/lib/driver-route/uploadHandoff";

const sessionStore = new Map<string, string>();

const sessionStorageMock = {
  getItem: vi.fn((key: string) => sessionStore.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    sessionStore.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    sessionStore.delete(key);
  }),
};

describe("uploaded route handoff", () => {
  beforeEach(() => {
    sessionStore.clear();
    vi.clearAllMocks();
    vi.stubGlobal("window", { sessionStorage: sessionStorageMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("discards malformed JSON instead of surfacing a syntax error", () => {
    sessionStore.set(UPLOADED_ROUTE_KEY, "{not-json");

    expect(readUploadedRoute()).toBeNull();
    expect(sessionStore.has(UPLOADED_ROUTE_KEY)).toBe(false);
  });
});
