import { retry } from "@/lib/utils/retry"

const VROOM_URL =
  process.env.VROOM_URL ||
  "http://localhost:3000" // adjust if needed

/**
 * Sends optimization request to VROOM
 */
export async function solverClient(payload: unknown) {

  const response = await retry(() =>
    fetch(`${VROOM_URL}/`, {
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
