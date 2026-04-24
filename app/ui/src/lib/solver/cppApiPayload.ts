import type { Delivery } from "@/lib/types/delivery.types"
import type { Vehicle } from "@/lib/types/vehicle.types"
import {
  relativeDayWindowToEpoch,
  type OptimizationJobRequestPayload,
} from "@/lib/solver/vroomMapping"

export type { OptimizationJobRequestPayload }

/**
 * Maps normalized UI models to the async optimization job request contract.
 */
export function buildOptimizationJobPayload(
  deliveries: Delivery[],
  vehicles: Vehicle[]
): OptimizationJobRequestPayload {
  if (vehicles.length === 0) {
    throw new Error("buildOptimizationJobPayload requires at least one vehicle")
  }

  const depot = vehicles[0].start

  const jobs = deliveries.map((d) => {
    const job: OptimizationJobRequestPayload["jobs"][0] = {
      id: String(d.id),
      location: d.location,
      demand: d.deliverySize[0],
    }
    if (d.serviceTime !== undefined) {
      job.service = d.serviceTime
    }
    if (d.timeWindows && d.timeWindows.length > 0) {
      job.time_windows = d.timeWindows.map(relativeDayWindowToEpoch)
    }
    return job
  })

  const cppVehicles = vehicles.map((v) => {
    const row: OptimizationJobRequestPayload["vehicles"][0] = {
      id: String(v.id),
      capacity: v.capacity[0],
      start: v.start,
    }
    if (v.end) {
      row.end = v.end
    }
    if (v.departureTime != null && v.returnTime != null) {
      row.time_window = relativeDayWindowToEpoch([v.departureTime, v.returnTime])
    }
    return row
  })

  return {
    depot: { location: [...depot] },
    vehicles: cppVehicles,
    jobs,
  }
}
