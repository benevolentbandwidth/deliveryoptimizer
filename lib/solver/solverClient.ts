import { retry } from "@/lib/utils/retry"

const VROOM_URL =
  process.env.VROOM_URL ||
  "http://localhost:3000" // adjust if needed


const TIMEOUT_MS = 10000 // 10 seconds

/**
 * Fetch wrapper with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit
) {

  const controller = new AbortController()

  const timeout = setTimeout(() => {
    controller.abort()
  }, TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Sends optimization request to VROOM
 */
export async function solverClient(payload: unknown) {

  const response = await retry(() =>
    fetchWithTimeout(`${VROOM_URL}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
  )

  // Throw Error
  if (!response.ok) {

    const text = await response.text()

    throw new Error(
      `VROOM Error (${response.status}): ${text}`
    )
  }

  return response.json()
}
