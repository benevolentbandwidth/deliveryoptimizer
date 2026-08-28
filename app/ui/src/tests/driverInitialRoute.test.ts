import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadInitialRoute } from "@/app/driver_assist/initialRoute";
import { STORAGE_KEY } from "@/app/driver_assist/storage";
import { createPersistedRouteState } from "@/lib/driver-route/importSession";
import { UPLOADED_ROUTE_KEY } from "@/lib/driver-route/uploadHandoff";

const localStore = new Map<string, string>();
const sessionStore = new Map<string, string>();

function createStorageMock(store: Map<string, string>) {
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
  };
}

describe("driver initial route loading", () => {
  beforeEach(() => {
    localStore.clear();
    sessionStore.clear();
    vi.stubGlobal("window", {
      localStorage: createStorageMock(localStore),
      sessionStorage: createStorageMock(sessionStore),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses saved progress when an uploaded route is invalid", () => {
    const savedRoute = {
      driverName: "Driver 1",
      routeLabel: "Active route",
      stops: [],
    };
    localStore.set(
      STORAGE_KEY,
      JSON.stringify(createPersistedRouteState(savedRoute)),
    );
    sessionStore.set(
      UPLOADED_ROUTE_KEY,
      JSON.stringify({ version: 1, savedAt: "invalid", route: null }),
    );

    expect(loadInitialRoute()).toEqual({
      route: savedRoute,
      source: "saved-after-invalid-upload",
    });
  });
});
