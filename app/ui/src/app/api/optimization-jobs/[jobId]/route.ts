import { NextResponse } from "next/server"

import { getOptimizationJobStatus } from "@/lib/solver/deliveryOptimizerClient"

import { maybeBuildDeliveryOptimizerErrorResponse } from "../routeHelpers"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ jobId: string }>
}

export async function GET(_req: Request, context: RouteContext) {
  const { jobId } = await context.params

  try {
    const result = await getOptimizationJobStatus(jobId)
    return NextResponse.json(result)
  } catch (error) {
    console.error(error)

    const upstreamError = maybeBuildDeliveryOptimizerErrorResponse(error, {
      badRequest: "Optimization job status request was invalid.",
      conflict: "Optimization job status conflicted with current state.",
      notFound: "Optimization job was not found.",
      serviceUnavailable: "Delivery optimizer service unavailable.",
      gatewayTimeout: "Optimization job status timed out.",
      badGateway: "Failed to fetch optimization job status.",
    })
    if (upstreamError) {
      return upstreamError
    }

    return NextResponse.json(
      { error: "Failed to fetch optimization job status." },
      { status: 500 }
    )
  }
}
