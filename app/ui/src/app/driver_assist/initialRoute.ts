import type { DriverRoute } from "@/lib/driver-route/types";
import { readUploadedRoute } from "@/lib/driver-route/uploadHandoff";

import { readSavedRoute } from "./storage";

export type InitialRouteLoad =
  | {
      route: DriverRoute;
      source: "uploaded" | "saved" | "saved-after-invalid-upload";
      errorMessage?: never;
    }
  | { route: null; source: "missing"; errorMessage?: never }
  | { route: null; source: "invalid-upload"; errorMessage: string };

export function loadInitialRoute(): InitialRouteLoad {
  try {
    const uploadedRoute = readUploadedRoute();
    if (uploadedRoute) {
      return { route: uploadedRoute, source: "uploaded" };
    }
  } catch (importError) {
    const savedRoute = readSavedRoute();
    if (savedRoute) {
      return { route: savedRoute, source: "saved-after-invalid-upload" };
    }

    return {
      route: null,
      source: "invalid-upload",
      errorMessage:
        importError instanceof Error
          ? importError.message
          : "Please upload a valid JSON file.",
    };
  }

  const savedRoute = readSavedRoute();
  return savedRoute
    ? { route: savedRoute, source: "saved" }
    : { route: null, source: "missing" };
}
