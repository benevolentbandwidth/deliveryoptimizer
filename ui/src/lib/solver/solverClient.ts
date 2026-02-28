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

/**
 * Sends optimization request to VROOM
 */

// Get payload type from buildPayload in payloadBuilder.ts
type SolverPayload = ReturnType<typeof buildPayload>

export async function solverClient(payload: SolverPayload) {

  const response = await retry(async () => {
    const res = await fetchWithTimeout(`${VROOM_URL}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })

    // Retry only transient errors
    if (!res.ok) {
      if (res.status >= 500 || res.status === 429) {
        throw new Error(`Retryable VROOM error ${res.status}`)
      }

      // Non-retryable so fail immediately
      const text = await res.text()
      throw new Error(`VROOM Error (${res.status}): ${text}`)
    }

    return res
  })

  // Check content type returned by VROOM
  const contentType = response.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(
      `Expected JSON from VROOM but received wrong type`
    )
  }
  
  return response.json()
}
