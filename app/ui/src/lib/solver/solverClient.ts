import { retry } from "@/lib/utils/retry"
import { buildPayload } from "@/lib/solver/payloadBuilder" 

const VROOM_URL =
  (process.env.VROOM_URL ?? "http://localhost:3000")
    .replace(/\/$/, "")


const TIMEOUT_MS = 10000 // 10 seconds

/**
 * Fetch wrapper with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit
) {

  const controller = new AbortController()

  const timeoutId = setTimeout(() => {
    controller.abort()
  }, TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

export type SolverClientError = Error & {
  source: "vroom"
  retryable: boolean
  status?: number
}

type SolverErrorOptions = {
  retryable: boolean
  status?: number
}

function createSolverClientError(
  message: string,
  options: SolverErrorOptions
): SolverClientError {
  const error = new Error(message) as SolverClientError
  error.source = "vroom"
  error.retryable = options.retryable
  error.status = options.status
  return error
}

export function isSolverClientError(
  error: unknown
): error is SolverClientError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "source" in error &&
      (error as { source?: unknown }).source === "vroom" &&
      "retryable" in error
  )
}

// Get payload type from buildPayload in payloadBuilder.ts
type SolverPayload = ReturnType<typeof buildPayload>

/**
 * Sends optimization request to VROOM
 */
export async function solverClient(payload: SolverPayload) {

  const response = await retry(async () => {
    let res: Response

    try {
      res = await fetchWithTimeout(`${VROOM_URL}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })
    } catch (error) {
      const isAbortError = Boolean(
        error &&
          typeof error === "object" &&
          "name" in error &&
          (error as { name?: string }).name === "AbortError"
      )

      throw createSolverClientError(
        isAbortError
          ? "VROOM request timed out"
          : "VROOM network failure",
        { retryable: false }
      )
    }

    // Retry only transient errors
    if (!res.ok) {
      if (res.status >= 500 || res.status === 429) {
        throw createSolverClientError(
          `VROOM transient upstream error (${res.status})`,
          { retryable: true, status: res.status }
        )
      }

      // Non-retryable so fail immediately
      const text = await res.text()
      throw createSolverClientError(
        `VROOM Error (${res.status}): ${text}`,
        { retryable: false, status: res.status }
      )
    }

    return res
  })

  // Check content type returned by VROOM
  const contentType = response.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    throw createSolverClientError(
      "VROOM responded with non-JSON content type",
      { retryable: false }
    )
  }
  
  return response.json()
}
