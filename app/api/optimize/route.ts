import { NextResponse } from "next/server"

import { optimizeRequestSchema } from "@/lib/validation/optimize.schema"

import { normalizeDeliveries } from "@/lib/solver/normalizers/deliveryNormalizer"
import { normalizeVehicles } from "@/lib/solver/normalizers/vehicleNormalizer"

import { buildPayload } from "@/lib/solver/payloadBuilder"
import { solverClient } from "@/lib/solver/solverClient"

export const runtime = "nodejs"

export async function POST(req: Request) {

  try {

    // 1️⃣ Parse JSON
    const body = await req.json()

    // 2️⃣ Validate (throws automatically if invalid)
    const validated =
      optimizeRequestSchema.parse(body)

    // 3️⃣ Normalize
    const deliveries =
      normalizeDeliveries(validated.deliveries)

    const vehicles =
      normalizeVehicles(validated.vehicles)

    // 4️⃣ Build solver payload
    const payload =
      buildPayload(deliveries, vehicles)

    // 5️⃣ Call solver
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
