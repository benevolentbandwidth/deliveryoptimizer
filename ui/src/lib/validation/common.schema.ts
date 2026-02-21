import { z } from "zod"

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
  value: z.number().positive()
})
