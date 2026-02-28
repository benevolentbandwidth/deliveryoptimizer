import { Delivery } from "@/lib/types/delivery.types"
import { Vehicle } from "@/lib/types/vehicle.types"

import {
  mapDeliveryToJob,
  mapVehicleToVroom
} from "./vroomMapper"

/**
 * Constructs the final VROOM payload.
 * PURE FUNCTION.
 */
export function buildPayload(
  deliveries: Delivery[],
  vehicles: Vehicle[]
) {
  return {
    vehicles: vehicles.map(mapVehicleToVroom),
    jobs: deliveries.map(mapDeliveryToJob)
  }
}
