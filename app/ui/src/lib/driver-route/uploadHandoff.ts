import {
  createPersistedRouteState,
  loadDriverRouteFromText,
  parsePersistedRouteState,
} from "./importSession";
import type { DriverRoute } from "./types";

export const UPLOADED_ROUTE_KEY = "driver_assist.uploadedRoute";
export const ROUTE_UPLOAD_ERROR_KEY = "routeUploadError";

type LegacyUploadedRouteFile = {
  name?: unknown;
  content?: unknown;
};

export function storeUploadedRoute(route: DriverRoute) {
  window.sessionStorage.setItem(
    UPLOADED_ROUTE_KEY,
    JSON.stringify(createPersistedRouteState(route)),
  );
}

export function readUploadedRoute(): DriverRoute | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(UPLOADED_ROUTE_KEY);
  if (!raw) return null;

  let parsed: LegacyUploadedRouteFile;
  try {
    parsed = JSON.parse(raw) as LegacyUploadedRouteFile;
  } catch {
    clearUploadedRoute();
    return null;
  }

  if (typeof parsed.name === "string" && typeof parsed.content === "string") {
    return loadDriverRouteFromText(parsed.content);
  }

  return parsePersistedRouteState(parsed).route;
}

export function clearUploadedRoute() {
  try {
    window.sessionStorage.removeItem(UPLOADED_ROUTE_KEY);
  } catch {
    // Storage can be unavailable in private browsing; callers can still recover.
  }
}

export function writeRouteUploadError(message: string) {
  try {
    window.sessionStorage.setItem(ROUTE_UPLOAD_ERROR_KEY, message);
    return true;
  } catch {
    return false;
  }
}

export function readRouteUploadError() {
  try {
    return window.sessionStorage.getItem(ROUTE_UPLOAD_ERROR_KEY);
  } catch {
    return null;
  }
}

export function clearRouteUploadError() {
  try {
    window.sessionStorage.removeItem(ROUTE_UPLOAD_ERROR_KEY);
  } catch {
    // Query-param fallback still renders the error when storage is blocked.
  }
}
