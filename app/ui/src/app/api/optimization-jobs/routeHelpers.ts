import { NextResponse } from "next/server"

import {
  isDeliveryOptimizerClientError,
  type DeliveryOptimizerClientError,
} from "@/lib/solver/deliveryOptimizerClient"

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

type FallbackMessages = {
  badRequest: string
  conflict: string
  notFound: string
  serviceUnavailable: string
  gatewayTimeout: string
  badGateway: string
}

export function buildDeliveryOptimizerErrorResponse(
  error: DeliveryOptimizerClientError,
  fallbackMessages: FallbackMessages
): NextResponse {
  const status = error.status ?? 502

  if (status === 400 && error.body && typeof error.body === "object") {
    return NextResponse.json(error.body, { status: 400 })
  }

  if (status === 404) {
    return NextResponse.json(
      { error: messageFromUpstreamBody(error.body, fallbackMessages.notFound) },
      { status: 404 }
    )
  }

  if (status === 409) {
    return NextResponse.json(
      { error: messageFromUpstreamBody(error.body, fallbackMessages.conflict) },
      { status: 409 }
    )
  }

  if (status === 503) {
    return NextResponse.json(
      {
        error: messageFromUpstreamBody(
          error.body,
          fallbackMessages.serviceUnavailable
        ),
      },
      { status: 503 }
    )
  }

  if (status === 504) {
    return NextResponse.json(
      { error: messageFromUpstreamBody(error.body, fallbackMessages.gatewayTimeout) },
      { status: 504 }
    )
  }

  if (status === 502) {
    return NextResponse.json(
      { error: messageFromUpstreamBody(error.body, fallbackMessages.badGateway) },
      { status: 502 }
    )
  }

  return NextResponse.json(
    {
      error: messageFromUpstreamBody(error.body, fallbackMessages.badGateway),
    },
    { status: 502 }
  )
}

export function maybeBuildDeliveryOptimizerErrorResponse(
  error: unknown,
  fallbackMessages: FallbackMessages
): NextResponse | null {
  if (!isDeliveryOptimizerClientError(error)) {
    return null
  }

  return buildDeliveryOptimizerErrorResponse(error, fallbackMessages)
}
