import type { Delivery } from "@/lib/types/delivery.types"
import type { Vehicle } from "@/lib/types/vehicle.types"
import {
  relativeDayWindowToEpoch,
  type CppDeliveriesOptimizeRequest,
} from "@/lib/solver/vroomMapping"

export type { CppDeliveriesOptimizeRequest }

/**
 * Maps normalized UI models to the POST /api/v1/deliveries/optimize JSON contract.
 * Depot defaults to the first vehicle's start location.
 */
export function buildCppDeliveriesOptimizePayload(
  deliveries: Delivery[],
  vehicles: Vehicle[]
): CppDeliveriesOptimizeRequest {
  if (vehicles.length === 0) {
    throw new Error("buildCppDeliveriesOptimizePayload requires at least one vehicle")
  }

  const depot = vehicles[0].start

  const jobs = deliveries.map((d) => {
    const job: CppDeliveriesOptimizeRequest["jobs"][0] = {
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
    const row: CppDeliveriesOptimizeRequest["vehicles"][0] = {
      id: String(v.id),
      capacity: v.capacity[0],
      start: v.start,
    }
    if (v.end) {
      row.end = v.end
    }
    if (v.timeWindow) {
      row.time_window = relativeDayWindowToEpoch(v.timeWindow)
    }
    return row
  })

  return {
    depot: { location: [...depot] },
    vehicles: cppVehicles,
    jobs,
  }
}
