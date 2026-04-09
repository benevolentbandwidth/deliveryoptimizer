import { NextResponse } from "next/server"

import { optimizeRequestSchema } from "@/lib/validation/optimize.schema"

import { normalizeDeliveries } from "@/lib/solver/normalizers/deliveryNormalizer"
import { normalizeVehicles } from "@/lib/solver/normalizers/vehicleNormalizer"

import { buildCppDeliveriesOptimizePayload } from "@/lib/solver/cppApiPayload"
import {
  postDeliveriesOptimize,
  isDeliveryOptimizerClientError,
} from "@/lib/solver/deliveryOptimizerClient"

export const runtime = "nodejs"

function messageFromUpstreamBody(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error
  }
  return fallback
}

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
        const field = String(path[2])
        message = `Delivery #${path[1] + 1} is missing ${field}`
      }

      if (
        path[0] === "vehicles" &&
        path.length >= 3 &&
        typeof path[1] === "number" &&
        first.code === "invalid_type"
      ) {
        const field = String(path[2])
        message = `Vehicle #${path[1] + 1} is missing ${field}`
      }

      return NextResponse.json({ error: message }, { status: 400 })
    }

    const validated = validation.data

    const deliveries = normalizeDeliveries(validated.deliveries)
    const vehicles = normalizeVehicles(validated.vehicles)

    const payload = buildCppDeliveriesOptimizePayload(deliveries, vehicles)
    const result = await postDeliveriesOptimize(payload)

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)

    if (isDeliveryOptimizerClientError(error)) {
      const status = error.status ?? 502

      if (status === 400 && error.body && typeof error.body === "object") {
        return NextResponse.json(error.body, { status: 400 })
      }

      if (status === 504) {
        return NextResponse.json(
          { error: messageFromUpstreamBody(error.body, "Routing optimization timed out.") },
          { status: 504 }
        )
      }

      if (status === 502) {
        return NextResponse.json(
          { error: messageFromUpstreamBody(error.body, "Routing optimization failed.") },
          { status: 502 }
        )
      }

      return NextResponse.json(
        { error: "Delivery optimizer service unavailable" },
        { status: 502 }
      )
    }

    return NextResponse.json({ error: "Optimization failed" }, { status: 500 })
  }
}
