import { NextResponse } from "next/server"

import { optimizeRequestSchema } from "@/lib/validation/optimize.schema"
import { normalizeDeliveries } from "@/lib/solver/normalizers/deliveryNormalizer"
import { normalizeVehicles } from "@/lib/solver/normalizers/vehicleNormalizer"
import { buildOptimizationJobPayload } from "@/lib/solver/cppApiPayload"
import { createOptimizationJob } from "@/lib/solver/deliveryOptimizerClient"

import { maybeBuildDeliveryOptimizerErrorResponse } from "./routeHelpers"

export const runtime = "nodejs"

export async function POST(req: Request) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 })
  }

  try {
    const validation = optimizeRequestSchema.safeParse(body)

    if (!validation.success) {
      const first = validation.error.issues[0]
      const path = first.path
      let message = first.message

      if (
        path[0] === "deliveries" &&
        path.length >= 3 &&
        typeof path[1] === "number" &&
        first.code === "invalid_type"
      ) {
        message = `Delivery #${path[1] + 1} is missing ${String(path[2])}`
      }

      if (
        path[0] === "vehicles" &&
        path.length >= 3 &&
        typeof path[1] === "number" &&
        first.code === "invalid_type"
      ) {
        message = `Vehicle #${path[1] + 1} is missing ${String(path[2])}`
      }

      return NextResponse.json({ error: message }, { status: 400 })
    }

    const validated = validation.data
    const deliveries = normalizeDeliveries(validated.deliveries)
    const vehicles = normalizeVehicles(validated.vehicles)
    const payload = buildOptimizationJobPayload(deliveries, vehicles)
    const result = await createOptimizationJob(payload)

    return NextResponse.json(result, { status: 202 })
  } catch (error) {
    console.error(error)

    const upstreamError = maybeBuildDeliveryOptimizerErrorResponse(error, {
      badRequest: "Optimization job request was invalid.",
      conflict: "Optimization job request conflicted with current state.",
      notFound: "Optimization job was not found.",
      serviceUnavailable: "Delivery optimizer service unavailable.",
      gatewayTimeout: "Routing optimization timed out.",
      badGateway: "Routing optimization failed.",
    })
    if (upstreamError) {
      return upstreamError
    }

    return NextResponse.json(
      { error: "Failed to create optimization job." },
      { status: 500 }
    )
  }
}
