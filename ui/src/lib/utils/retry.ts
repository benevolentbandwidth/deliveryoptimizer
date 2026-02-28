/**
 * Retries with exponential backoff
 * Retries include initial attempt
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 200
): Promise<T> {

  try {
    return await fn()

  } catch (error) {

    // Non-Retryable Abort Error
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError"
    ) {
      throw error
    }

    // Non-Retryable Error
    if (
      error instanceof Error &&
      error.message.startsWith("NON_RETRYABLE:")
    ) {
      throw error
    }
    
    // Already Did 3 retries (including initial attempt)
    if (retries <= 1) {
      throw error
    }

    await new Promise(res =>
      setTimeout(res, delayMs)
    )

    // exponential backoff (x2)
    return retry(fn, retries - 1, delayMs * 2)
  }
}
