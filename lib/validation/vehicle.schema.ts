import { z } from "zod"
import { locationSchema, loadSchema } from "./common.schema"

export const vehicleSchema = z.object({
  id: z.string().min(1),

  vehicleType: z.string().min(1),

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
    !data.departureTime ||
    !data.returnTime ||
    data.returnTime > data.departureTime,
  {
    message: "returnTime must be greater than departureTime"
  })

export const vehiclesSchema = z.array(vehicleSchema)
