import { z } from "zod"
import { locationSchema, loadSchema } from "./common.schema"

export const vehicleSchema = z.object({
  id: z.number().int().nonnegative(),

  vehicleType: z.enum(["truck", "car", "bicycle"]),

  driverName: z.string().min(1).optional(),

  startLocation: locationSchema,

  endLocation: locationSchema.optional(),

  capacity: loadSchema,

  departureTime: z
    .number()
    .int()
    .nonnegative()
    .optional(),

  returnTime: z
    .number()
    .int()
    .nonnegative()
    .optional()
}).refine(
  (data) =>
    (data.departureTime == null && data.returnTime == null) ||
    (data.departureTime != null && data.returnTime != null),
).refine(
  (data) =>
    data.departureTime == null ||
    data.returnTime == null ||
    data.returnTime > data.departureTime,
)

/**
 * Ensure each ID is unique
 */
export const vehiclesSchema = z
  .array(vehicleSchema)
  .superRefine((vehicles, ctx) => {
    const seen = new Set<number>()

    vehicles.forEach((vehicle, index) => {
      if (seen.has(vehicle.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate vehicle id: ${vehicle.id}`,
          path: [index, "id"]
        })
      }

      seen.add(vehicle.id)
    })
  })
