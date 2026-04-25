import { z } from "zod"
import { locationSchema, loadSchema, MAX_DEMAND, MAX_BUFFER_TIME } from "./common.schema"

export const deliverySchema = z.object({
  id: z.number().int().nonnegative(),

  recipientName: z.string().min(1).optional(),

  phoneNumber: z.string().min(7).optional(),

  address: z.string().optional(),

  notes: z.string().optional(),

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
        {
          message: "timeWindows end must be after start",
          path: [1]
        }
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
    const seen = new Set<number>()

    deliveries.forEach((delivery, index) => {
      if (seen.has(delivery.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate delivery id: ${delivery.id}`,
          path: [index, "id"]
        })
      }

      seen.add(delivery.id)
    })
  })
