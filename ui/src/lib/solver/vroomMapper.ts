import { Delivery } from "@/lib/types/delivery.types"
import { Vehicle } from "@/lib/types/vehicle.types"

/**
 * Maps internal Delivery → VROOM Job
 */
export function mapDeliveryToJob(delivery: Delivery) {
  return {
    id: delivery.id,
    location: delivery.location,
    service: delivery.serviceTime,
    delivery: delivery.deliverySize,
    timeWindows: delivery.timeWindows,
  }
}

/**
 * Maps internal Vehicle → VROOM Vehicle
 */
export function mapVehicleToVroom(vehicle: Vehicle) {
  return {
    id: vehicle.id,
    start: vehicle.start,
    end: vehicle.end,
    capacity: vehicle.capacity,
    timeWindow: vehicle.timeWindow
  }
}
