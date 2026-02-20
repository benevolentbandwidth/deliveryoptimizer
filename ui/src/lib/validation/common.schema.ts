import { z } from "zod"

/**
 * Shared numeric limits
 */
export const MAX_CAPACITY = 1_000_000 // max capacity held by one vehicle
export const MAX_DEMAND = 1_000_000 // max load for one delivery
export const MAX_BUFFER_TIME = 86_400 // buffer time between deliveries in seconds (24hrs)

/**
 * Latitude must be between -90 and 90
 * Longitude must be between -180 and 180
 */
export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
})

/**
 * Load schema supports future expansion
 */
export const loadSchema = z.object({
  type: z.enum(["units", "weight", "volume"]),
    value: z
    .number()
    .positive()
    .max(MAX_CAPACITY)
})
