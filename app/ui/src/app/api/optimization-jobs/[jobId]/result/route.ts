import { NextResponse } from "next/server"

import { getOptimizationJobResult } from "@/lib/solver/deliveryOptimizerClient"

import { maybeBuildDeliveryOptimizerErrorResponse } from "../../routeHelpers"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ jobId: string }>
}

export async function GET(_req: Request, context: RouteContext) {
  const { jobId } = await context.params

  try {
    const result = await getOptimizationJobResult(jobId)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error(error)

    const upstreamError = maybeBuildDeliveryOptimizerErrorResponse(error, {
      badRequest: "Optimization job result request was invalid.",
      conflict: "Optimization job result is not ready yet.",
      notFound: "Optimization job result was not found.",
      serviceUnavailable: "Delivery optimizer service unavailable.",
      gatewayTimeout: "Optimization job result request timed out.",
      badGateway: "Failed to fetch optimization job result.",
    })
    if (upstreamError) {
      return upstreamError
    }

    return NextResponse.json(
      { error: "Failed to fetch optimization job result." },
      { status: 500 }
    )
  }
}
