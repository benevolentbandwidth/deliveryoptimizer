import { retry } from "@/lib/utils/retry"
import type { CppDeliveriesOptimizeRequest } from "@/lib/solver/cppApiPayload"

const API_BASE = (
  process.env.DELIVERYOPTIMIZER_API_URL ?? "http://127.0.0.1:8080"
).replace(/\/$/, "")

const OPTIMIZE_PATH = "/api/v1/deliveries/optimize"

const TIMEOUT_MS = Number(
  process.env.DELIVERYOPTIMIZER_API_TIMEOUT_MS ?? 60000
)

async function fetchWithTimeout(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

export type DeliveryOptimizerClientError = Error & {
  source: "deliveryoptimizer-api"
  retryable: boolean
  status?: number
  body?: unknown
}

type ErrorOptions = {
  retryable: boolean
  status?: number
  body?: unknown
}

function createError(
  message: string,
  options: ErrorOptions
): DeliveryOptimizerClientError {
  const err = new Error(message) as DeliveryOptimizerClientError
  err.source = "deliveryoptimizer-api"
  err.retryable = options.retryable
  err.status = options.status
  err.body = options.body
  return err
}

export function isDeliveryOptimizerClientError(
  error: unknown
): error is DeliveryOptimizerClientError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "source" in error &&
      (error as { source?: unknown }).source === "deliveryoptimizer-api" &&
      "retryable" in error
  )
}

/**
 * POSTs to /api/v1/deliveries/optimize on the C++ backend and returns parsed JSON.
 */
export async function postDeliveriesOptimize(
  payload: CppDeliveriesOptimizeRequest
): Promise<unknown> {
  const url = `${API_BASE}${OPTIMIZE_PATH}`

  const response = await retry(async () => {
    let res: Response
    try {
      res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      const aborted =
        error &&
        typeof error === "object" &&
        "name" in error &&
        (error as { name?: string }).name === "AbortError"
      throw createError(
        aborted ? "Optimizer request timed out" : "Optimizer network failure",
        { retryable: false }
      )
    }

    if (!res.ok) {
      if (res.status >= 500 || res.status === 429) {
        throw createError(
          `Optimizer transient upstream error (${res.status})`,
          { retryable: true, status: res.status }
        )
      }
      let body: unknown
      const text = await res.text()
      try {
        body = text ? JSON.parse(text) : undefined
      } catch {
        body = text
      }
      throw createError(
        `Optimizer error (${res.status})`,
        { retryable: false, status: res.status, body }
      )
    }

    return res
  })

  const contentType = response.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    throw createError("Optimizer returned non-JSON content type", {
      retryable: false,
      status: response.status,
    })
  }

  return response.json()
}
