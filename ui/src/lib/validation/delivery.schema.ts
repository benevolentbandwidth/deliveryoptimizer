import { z } from "zod"
import { locationSchema, loadSchema, MAX_DEMAND, MAX_BUFFER_TIME } from "./common.schema"

export const deliverySchema = z.object({
  id: z.string().min(1),

  address: z.string().optional(),

  location: locationSchema,

  bufferTime: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_BUFFER_TIME)
    .optional(),

  demand: loadSchema.extend({
    value: z.number().positive().max(MAX_DEMAND)
  }),

  timeWindows: z
    .array(
      z.tuple([
        z.number().int(),
        z.number().int()
      ]).refine(
        ([start, end]) => end > start,
        { message: "time_window end must be after start" }
      )
    )
    .optional()

})

/**
 * Useful when validating arrays from requests
 */
export const deliveriesSchema = z.array(deliverySchema)
