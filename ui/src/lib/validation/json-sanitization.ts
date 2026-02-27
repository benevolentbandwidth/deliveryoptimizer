import type { OptimizeRequest } from "../types/optimize.types"

function cleanText(value: string): string {
  return value
    .replace(/javascript:/gi, "")
    .replace(/<\s*script/gi, "<script")
}

export function sanitizeOptimizeRequest(state: OptimizeRequest): OptimizeRequest {
  // checks if arrays are missing then keep states unchanged
  if (!Array.isArray(state.deliveries) || !Array.isArray(state.vehicles)) {
    return state
  }

  return {
    ...state,

    // Clean text fields on deliveries.
    deliveries: state.deliveries.map((d) => ({
      ...d,
      id: typeof d.id === "string" ? cleanText(d.id) : d.id,
      address: typeof d.address === "string" ? cleanText(d.address) : d.address,
    })),

    // Clean text fields on vehicles.
    vehicles: state.vehicles.map((v) => ({
      ...v,
      id: typeof v.id === "string" ? cleanText(v.id) : v.id,
      vehicleType:
        typeof v.vehicleType === "string" ? cleanText(v.vehicleType) : v.vehicleType,
    })),
  }
}