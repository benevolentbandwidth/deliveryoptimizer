import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  persistRoute,
  readSavedRoute,
  STORAGE_KEY,
} from "@/app/driver_assist/storage";
import { createPersistedRouteState } from "@/lib/driver-route/importSession";
import type { DriverRoute } from "@/lib/driver-route/types";

const localStore = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => localStore.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStore.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    localStore.delete(key);
  }),
};

const route: DriverRoute = {
  driverName: "Driver 1",
  routeLabel: "Route 1",
  stops: [],
};

describe("driver route storage snapshots", () => {
  beforeEach(() => {
    localStore.clear();
    vi.clearAllMocks();
    vi.stubGlobal("window", {
      localStorage: localStorageMock,
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal(
      "Event",
      class {
        constructor(public readonly type: string) {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the same snapshot while serialized storage is unchanged", () => {
    localStore.set(
      STORAGE_KEY,
      JSON.stringify(createPersistedRouteState(route)),
    );

    const firstSnapshot = readSavedRoute();
    const secondSnapshot = readSavedRoute();

    expect(firstSnapshot).toBe(secondSnapshot);
  });

  it("returns a new snapshot after serialized storage changes", () => {
    persistRoute(route);
    const firstSnapshot = readSavedRoute();
    localStore.set(
      STORAGE_KEY,
      JSON.stringify(
        createPersistedRouteState({ ...route, routeLabel: "Route 2" }),
      ),
    );

    const secondSnapshot = readSavedRoute();

    expect(secondSnapshot).not.toBe(firstSnapshot);
    expect(secondSnapshot?.routeLabel).toBe("Route 2");
  });
});
