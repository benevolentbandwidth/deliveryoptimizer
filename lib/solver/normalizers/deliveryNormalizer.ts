import {
  DeliveryInput,
  Delivery
} from "@/lib/types/delivery.types"

/**
 * Converts API delivery shape → internal domain model
 */
export function normalizeDelivery(
  input: DeliveryInput
): Delivery {
  return {
    id: input.id,

    // 🚨 ALWAYS [lng, lat] for routing engines
    location: [
      input.location.lng,
      input.location.lat
    ],

    serviceTime: input.bufferTime,

    deliverySize: [input.demand.value],
    
    timeWindows: input.time_windows

  }
}

/**
 * Normalize an array of deliveries
 */
export function normalizeDeliveries(
  inputs: DeliveryInput[]
): Delivery[] {
  return inputs.map(normalizeDelivery)
}
