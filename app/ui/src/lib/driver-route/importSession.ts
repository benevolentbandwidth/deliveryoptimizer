import { ZodError, z } from "zod";

import { createPendingDeliveryStop } from "./createDeliveryStop";
import type { DriverRoute, OptimizeRequestLike } from "./types";
import { transformSessionToDriverRoute } from "./transformSession";
import {
  migrateSessionSaveFile,
  sessionSaveDataSchema,
} from "@/lib/validation/session.schema";

const persistedStopSchema = z.object({
  id: z.string(),
  stopNumber: z.number(),
  address: z.string(),
  customerName: z.string(),
  phoneNumber: z.string().optional(),
  packageCount: z.number(),
  notes: z.string(),
  status: z.enum(["pending", "completed", "failed"]),
  lat: z.number(),
  lng: z.number(),
  completedAt: z.string().optional(),
  failureReason: z.string().optional(),
});

const persistedRouteSchema = z.object({
  driverName: z.string(),
  routeLabel: z.string(),
  stops: z.array(persistedStopSchema),
});

const persistedRouteStateSchema = z.object({
  version: z.literal(1),
  savedAt: z.string().datetime(),
  route: persistedRouteSchema,
});

type PersistedRouteState = z.infer<typeof persistedRouteStateSchema>;

const resultsRouteStopSchema = z.object({
  id: z.union([z.string(), z.number()]),
  address: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  sequence: z.number().int().nonnegative(),
  capacityUsed: z.number().nonnegative().optional(),
  note: z.string().optional(),
  addresseeName: z.string().optional(),
  phoneNumber: z.string().optional(),
});

const resultsRouteSchema = z.object({
  vehicleId: z.union([z.string(), z.number()]),
  driverName: z.string().optional(),
  stops: z.array(resultsRouteStopSchema).min(1),
});

export function loadDriverRouteFromText(text: string): DriverRoute {
  if (text.length === 0) {
    throw new Error("Invalid file contents.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }

  const exportedRoute = resultsRouteSchema.safeParse(parsed);
  if (exportedRoute.success) {
    return transformResultsRouteToDriverRoute(exportedRoute.data);
  }

  try {
    return transformSessionToDriverRoute(loadSessionFromParsedJson(parsed));
  } catch (error) {
    throw new Error(
      formatValidationError(error) ??
        "This file is not a recognized route or session JSON file.",
    );
  }
}

// Local progress uses a small envelope, separate from imported save files.
export function createPersistedRouteState(
  route: DriverRoute,
): PersistedRouteState {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    route,
  };
}

export function parsePersistedRouteState(input: unknown): PersistedRouteState {
  return persistedRouteStateSchema.parse(input);
}

function formatValidationError(error: unknown): string | null {
  if (!(error instanceof ZodError)) {
    return error instanceof Error ? error.message : null;
  }

  // Return the first useful location instead of dumping the whole Zod payload.
  const issue = error.issues[0];
  if (!issue) return null;

  const path =
    Array.isArray(issue.path) && issue.path.length
      ? issue.path.join(".")
      : "file";

  return `Invalid save file format at "${path}".`;
}

function loadSessionFromParsedJson(parsed: unknown): OptimizeRequestLike {
  try {
    // Preferred route-manager save file shape.
    return migrateSessionSaveFile(parsed).data;
  } catch (error) {
    try {
      // Also accept the same data shape without the version/savedAt envelope.
      return sessionSaveDataSchema.parse(parsed);
    } catch {
      throw error;
    }
  }
}

function transformResultsRouteToDriverRoute(
  route: z.infer<typeof resultsRouteSchema>,
): DriverRoute {
  const orderedStops = [...route.stops].sort((a, b) => a.sequence - b.sequence);
  const stops = orderedStops.map((stop, index) =>
    createPendingDeliveryStop({
      id: stop.id,
      index,
      address: stop.address,
      customerName: stop.addresseeName,
      phoneNumber: stop.phoneNumber,
      packageCount: stop.capacityUsed,
      notes: stop.note,
      lat: stop.lat,
      lng: stop.lng,
    }),
  );

  return {
    driverName: route.driverName || "driver_assist",
    routeLabel: `Route ${route.vehicleId} - ${stops.length} stops`,
    stops,
  };
}
