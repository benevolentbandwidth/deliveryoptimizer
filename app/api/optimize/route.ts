import { NextResponse } from "next/server"

import { optimizeRequestSchema } from "@/lib/validation/optimize.schema"

import { normalizeDeliveries } from "@/lib/solver/normalizers/deliveryNormalizer"
import { normalizeVehicles } from "@/lib/solver/normalizers/vehicleNormalizer"

import { buildPayload } from "@/lib/solver/payloadBuilder"
import { solverClient } from "@/lib/solver/solverClient"

export const runtime = "nodejs"

export async function POST(req: Request) {

  try {

    // Parse JSON
    const body = await req.json()

    // Validate (throws automatically if invalid)
    const validation =
      optimizeRequestSchema.safeParse(body)

    // Find and Display Correct Error Message
    if (!validation.success) {

      const first = validation.error.issues[0]

      const path = first.path
      let message = first.message

      if (path[0] === "deliveries") {
        const index = Number(path[1]) + 1
        const field = String(path[path.length - 1])
        message = `Delivery #${index} is missing ${field}`
      }

      if (path[0] === "vehicles") {
        const index = Number(path[1]) + 1
        const field = String(path[path.length - 1])
        message = `Vehicle #${index} is missing ${field}`
      }

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

    return NextResponse.json(
      { error: "Optimization failed" },
      { status: 500 }
    )
  }
}
