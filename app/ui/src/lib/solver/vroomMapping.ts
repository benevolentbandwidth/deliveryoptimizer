/** Seconds since Unix epoch at UTC midnight for the current calendar day. */
export function utcMidnightTodayUnixSeconds(): number {
  const d = new Date()
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000
  )
}

/**
 * UI time windows are seconds-from-midnight within a service day.
 * The C++ API expects [start, end] as non-negative Unix epoch seconds.
 */
export function relativeDayWindowToEpoch([start, end]: [number, number]): [number, number] {
  const base = utcMidnightTodayUnixSeconds()
  return [base + start, base + end]
}

export type OptimizationJobRequestPayload = {
  depot: { location: [number, number] }
  vehicles: Array<{
    id: string
    capacity: number
    start: [number, number]
    end?: [number, number]
    time_window?: [number, number]
  }>
  jobs: Array<{
    id: string
    location: [number, number]
    demand?: number
    service?: number
    time_windows?: [number, number][]
  }>
}
