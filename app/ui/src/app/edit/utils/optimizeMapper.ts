/**
 * Pure functions that transform edit-page form state into the shapes
 * expected by /api/optimize (VehicleInput, DeliveryInput).
 */

import { timeToSeconds } from "@/app/components/AddressGeocoder/utils/timeConversion";
import type { VehicleRow } from "../types/delivery";
import type { AddressCard } from "../types/delivery";
import type { VehicleInput } from "@/lib/types/vehicle.types";
import type { DeliveryInput } from "@/lib/types/delivery.types";
import type { Location } from "@/lib/types/common.types";

/**
 * Parses TIME_BUFFER_OPTIONS strings to seconds.
 * "5 min" → 300, "45 min" → 2700, "1hr" → 3600, "8hr" → 28800
 */
export function timeBufferToSeconds(buffer: string): number {
  const lower = buffer.trim().toLowerCase();
  if (lower.includes("min")) {
    return parseInt(lower) * 60;
  }
  if (lower.endsWith("hr")) {
    return parseInt(lower) * 3600;
  }
  return 0;
}

/**
 * Converts a "Delivery by" time string to a VROOM time window.
 * "2:00 PM" → [0, 50400] (window: midnight until deadline)
 */
export function deliveryByToTimeWindow(time: string): [number, number] {
  return [0, timeToSeconds(time)];
}

/**
 * Converts a "Delivery between" window string to a VROOM time window.
 * "1am - 2am" → [3600, 7200]
 */
export function deliveryBetweenToTimeWindow(window: string): [number, number] {
  const [start, end] = window.split(" - ").map((s) => timeToSeconds(s.toUpperCase()));
  return [start, end];
}

/**
 * Maps a locked VehicleRow + geocoded location to a VehicleInput for the API.
 * If the vehicle has a departure time, returnTime is set to end-of-day (86400 s)
 * to satisfy the "both or neither" constraint in the vehicle schema.
 */
export function vehicleRowToVehicleInput(
  v: VehicleRow,
  location: Location
): VehicleInput {
  const departureSeconds = v.departureTime
    ? timeToSeconds(v.departureTime)
    : undefined;

  return {
    id: v.id,
    vehicleType: v.type as VehicleInput["vehicleType"],
    startLocation: location,
    capacity: {
      type: v.capacityUnit as VehicleInput["capacity"]["type"],
      value: v.capacity,
    },
    ...(departureSeconds !== undefined && {
      departureTime: departureSeconds,
      returnTime: 86400,
    }),
  };
}

/**
 * Maps a locked AddressCard + geocoded location to a DeliveryInput for the API.
 */
export function addressCardToDeliveryInput(
  a: AddressCard,
  location: Location
): DeliveryInput {
  const timeWindow: [number, number] =
    a.deliveryTimeMode === "by"
      ? deliveryByToTimeWindow(a.deliveryBy)
      : deliveryBetweenToTimeWindow(a.deliveryBetween);

  return {
    id: a.id,
    address: a.recipientAddress,
    location,
    bufferTime: timeBufferToSeconds(a.timeBuffer),
    demand: { type: "units", value: a.deliveryQuantity },
    timeWindows: [timeWindow],
  };
}
