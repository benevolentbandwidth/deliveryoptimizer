/**
 * Retries with exponential backoff
 */
type RetryTaggedError = {
  retryable?: boolean
}

function isRetryable(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "retryable" in error &&
      (error as RetryTaggedError).retryable === true
  )
}

export async function retry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 200
): Promise<T> {

  try {
    return await fn()

  } catch (error) {

    if (!isRetryable(error) || retries < 1) {
      throw error
    }

    await new Promise(res =>
      setTimeout(res, delayMs)
    )

    // exponential backoff (x2)
    return retry(fn, retries - 1, delayMs * 2)
  }
}
