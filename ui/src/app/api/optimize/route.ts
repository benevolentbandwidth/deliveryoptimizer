import { NextResponse } from "next/server"

import { optimizeRequestSchema } from "@/lib/validation/optimize.schema"

import { normalizeDeliveries } from "@/lib/solver/normalizers/deliveryNormalizer"
import { normalizeVehicles } from "@/lib/solver/normalizers/vehicleNormalizer"

import { buildPayload } from "@/lib/solver/payloadBuilder"
import { solverClient } from "@/lib/solver/solverClient"

export const runtime = "nodejs"

export async function POST(req: Request) {

  let body: unknown

  // Check if JSON is Valid
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON format" },
      { status: 400 }
    )
  }

  // If Valid JSON
  try {

    // Schema Validation 
    const validation =
      optimizeRequestSchema.safeParse(body)

    // Find and Display Correct Error Message
    if (!validation.success) {
      const first = validation.error.issues[0]  // Only first error is displayed to user

      const path = first.path
      let message = first.message

      // Delivery missing field override
      if (
        path[0] === "deliveries" &&
        path.length >= 3 &&
        typeof path[1] === "number" &&
        first.code === "invalid_type"
      ) {
        const field = String(path[2])
        message = `Delivery #${path[1] + 1} is missing ${field}`
      }

      // Vehicle missing field override
      if (
        path[0] === "vehicles" &&
        path.length >= 3 &&
        typeof path[1] === "number" &&
        first.code === "invalid_type"
      ) {
        const field = String(path[2])
        message = `Vehicle #${path[1] + 1} is missing ${field}`
      }

      // Return Error Message
      return NextResponse.json(
        { error: message },
        { status: 400 }
      )
    }

    const validated = validation.data


    // Normalize
    const deliveries =
      normalizeDeliveries(validated.deliveries)

    const vehicles =
      normalizeVehicles(validated.vehicles)

    // Build solver payload
    const payload =
      buildPayload(deliveries, vehicles)

    // Call solver
    const result =
      await solverClient(payload)

    return NextResponse.json(result)

  } catch (error) {
    console.error(error)

    const message =
      error instanceof Error ? error.message : ""

    if (message.includes("VROOM")) {
      return NextResponse.json(
        { error: "VROOM Solver service unavailable" },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { error: "Optimization failed" },
      { status: 500 }
    )
  }
}
