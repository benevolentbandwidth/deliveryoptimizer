import {
  VehicleInput,
  Vehicle
} from "@/lib/types/vehicle.types"

/**
 * Converts API vehicle shape → internal domain model
 */
export function normalizeVehicle(
  input: VehicleInput
): Vehicle {
  return {
    id: input.id,

    start: [
      input.startLocation.lng,
      input.startLocation.lat
    ],

    end: input.endLocation
      ? [
          input.endLocation.lng,
          input.endLocation.lat
        ]
      : undefined,

    capacity: [input.capacity.value],

    timeWindow:
      input.departureTime !== undefined &&
      input.returnTime !== undefined
        ? [input.departureTime, input.returnTime]
        : undefined
  }
}

/**
 * Normalize an array of vehicles
 */
export function normalizeVehicles(
  inputs: VehicleInput[]
): Vehicle[] {
  return inputs.map(normalizeVehicle)
}
