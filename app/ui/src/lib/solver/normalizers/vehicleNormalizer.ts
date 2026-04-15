import {
  VehicleInput,
  Vehicle
} from "@/lib/types/vehicle.types"

/**
 * Converts API vehicle shape to internal domain model
 */
export function normalizeVehicle(
  input: VehicleInput
): Vehicle {
  return {
    id: input.id,

    profile: input.vehicleType,

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

    departureTime: input.departureTime,

    returnTime: input.returnTime
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
