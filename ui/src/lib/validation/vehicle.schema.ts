import { z } from "zod"
import { locationSchema, loadSchema } from "./common.schema"

export const vehicleSchema = z.object({
  id: z.number().int().nonnegative(),

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
    data.departureTime == null ||
    data.returnTime == null ||
    data.returnTime > data.departureTime,
  {
    message: "returnTime must be after departureTime"
  })
  .refine(
  (data) => 
    (data.departureTime === undefined) === (data.returnTime === undefined),
  { 
    message: "departureTime and returnTime must both be provided or both omitted" 
  })

export const vehiclesSchema = z.array(vehicleSchema)
