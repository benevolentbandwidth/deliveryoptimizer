import { retry } from "@/lib/utils/retry"
import type { OptimizationJobRequestPayload } from "@/lib/solver/cppApiPayload"

const API_BASE = (
  process.env.DELIVERYOPTIMIZER_API_URL ?? "http://127.0.0.1:8080"
).replace(/\/$/, "")

const OPTIMIZATION_JOBS_PATH = "/api/v1/optimization-jobs"

const TIMEOUT_MS = Number(
  process.env.DELIVERYOPTIMIZER_API_TIMEOUT_MS ?? 60000
)

export type DeliveryOptimizerClientError = Error & {
  source: "deliveryoptimizer-api"
  retryable: boolean
  status?: number
  body?: unknown
}

export type OptimizationJobState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "timed_out"
  | "expired"

export type OptimizationJobStatus = {
  job_id: string
  status: OptimizationJobState
  error?: string
  [key: string]: unknown
}

type ErrorOptions = {
  retryable: boolean
  status?: number
  body?: unknown
}

type JsonResponse<T> = {
  status: number
  body: T
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

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return undefined
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function isJsonContentType(contentType: string | null): boolean {
  return Boolean(contentType && contentType.includes("application/json"))
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  return (await requestJsonResponse<T>(path, options)).body
}

async function requestJsonResponse<T>(
  path: string,
  options: RequestInit = {}
): Promise<JsonResponse<T>> {
  const url = `${API_BASE}${path}`

  const response = await retry(async () => {
    let res: Response
    try {
      res = await fetchWithTimeout(url, options)
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
      const body = await parseResponseBody(res)
      if (res.status >= 500 || res.status === 429) {
        throw createError(`Optimizer transient upstream error (${res.status})`, {
          retryable: true,
          status: res.status,
          body,
        })
      }

      throw createError(`Optimizer error (${res.status})`, {
        retryable: false,
        status: res.status,
        body,
      })
    }

    return res
  })

  if (!isJsonContentType(response.headers.get("content-type"))) {
    throw createError("Optimizer returned non-JSON content type", {
      retryable: false,
      status: response.status,
    })
  }

  try {
    return {
      status: response.status,
      body: (await response.json()) as T,
    }
  } catch {
    throw createError("Optimizer returned invalid JSON", {
      retryable: false,
      status: response.status,
    })
  }
}

export async function createOptimizationJob(
  payload: OptimizationJobRequestPayload
): Promise<OptimizationJobStatus> {
  return requestJson<OptimizationJobStatus>(OPTIMIZATION_JOBS_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function getOptimizationJobStatus(
  jobId: string
): Promise<OptimizationJobStatus> {
  return requestJson<OptimizationJobStatus>(
    `${OPTIMIZATION_JOBS_PATH}/${encodeURIComponent(jobId)}`
  )
}

export async function getOptimizationJobResult(
  jobId: string
): Promise<JsonResponse<unknown>> {
  return requestJsonResponse<unknown>(
    `${OPTIMIZATION_JOBS_PATH}/${encodeURIComponent(jobId)}/result`
  )
}
