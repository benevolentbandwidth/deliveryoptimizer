import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readUploadedRoute,
  storeUploadedRoute,
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

  it("formats persisted route validation errors for drivers", () => {
    sessionStore.set(UPLOADED_ROUTE_KEY, JSON.stringify({ version: 1 }));

    expect(() => readUploadedRoute()).toThrow(
      'Invalid save file format at "savedAt".',
    );
  });

  it("does not overwrite the legacy driver-view route file", () => {
    const legacyRouteFile = JSON.stringify({
      name: "legacy-route.json",
      content: "{}",
    });
    sessionStore.set("routeFile", legacyRouteFile);

    storeUploadedRoute({
      driverName: "Driver 1",
      routeLabel: "Route 1",
      stops: [],
    });

    expect(sessionStore.get("routeFile")).toBe(legacyRouteFile);
    expect(sessionStore.has(UPLOADED_ROUTE_KEY)).toBe(true);
  });
});
