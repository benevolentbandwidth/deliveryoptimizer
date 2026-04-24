/**
 * Pure functions that transform edit-page form state into the shapes
 * expected by the optimization jobs submit route.
 */

import { timeToSeconds } from "@/app/components/AddressGeocoder/utils/timeConversion";
import type { LockedVehicleRow, CapacityUnit } from "../types/delivery";
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
    return parseInt(lower, 10) * 60;
  }
  if (lower.endsWith("hr")) {
    return parseInt(lower, 10) * 3600;
  }
  return 0;
}


/**
 * Maps a locked VehicleRow + geocoded location to a VehicleInput for the API.
 * If the vehicle has a departure time, returnTime is set to end-of-day (86400 s)
 * to satisfy the "both or neither" constraint in the vehicle schema.
 */
export function vehicleRowToVehicleInput(
  v: LockedVehicleRow,
  location: Location
): VehicleInput {
  const departureSeconds = v.departureTime
    ? timeToSeconds(v.departureTime)
    : undefined;

  return {
    id: v.id,
    vehicleType: v.type,
    startLocation: location,
    capacity: {
      type: v.capacityUnit,
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
  location: Location,
  demandType: CapacityUnit
): DeliveryInput {
  const { deliveryTimeStart: start, deliveryTimeEnd: end } = a;
  let timeWindow: [number, number] | undefined;
  if (start && end) {
    timeWindow = [timeToSeconds(start), timeToSeconds(end)];
  } else if (start) {
    timeWindow = [timeToSeconds(start), 86400];
  } else if (end) {
    timeWindow = [0, timeToSeconds(end)];
  }

  return {
    id: a.id,
    address: a.recipientAddress,
    location,
    bufferTime: a.timeBuffer ? timeBufferToSeconds(a.timeBuffer) : 0,
    demand: { type: demandType, value: a.deliveryQuantity },
    ...(timeWindow && { timeWindows: [timeWindow] }),  };
}
