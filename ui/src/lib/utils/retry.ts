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
