import { z } from "zod"
import { locationSchema, loadSchema, MAX_DEMAND, MAX_BUFFER_TIME } from "./common.schema"

export const deliverySchema = z.object({
  id: z.number().int().nonnegative(),

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
 * Ensure each ID is unique
 */
export const deliveriesSchema = z
  .array(deliverySchema)
  .superRefine((deliveries, ctx) => {
    const seen = new Map<number, number>()

    deliveries.forEach((delivery, index) => {
      if (seen.has(delivery.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate delivery id: ${delivery.id}`,
          path: [index, "id"]
        })
      } else {
        seen.set(delivery.id, index)
      }
    })
  })