/**
 * Retries an async function with delay.
 * Useful for flaky network calls.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 500
): Promise<T> {

  try {
    return await fn()

  } catch (error) {

    if (retries === 0) {
      throw error
    }

    // wait before retrying
    await new Promise(res =>
      setTimeout(res, delayMs)
    )

    return retry(fn, retries - 1, delayMs)
  }
}
