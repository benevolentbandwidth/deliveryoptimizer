import { z } from "zod"
import { deliveriesSchema } from "./delivery.schema"
import { vehiclesSchema } from "./vehicle.schema"

export const optimizeRequestSchema = z.object({
  deliveries: deliveriesSchema.min(1),
  vehicles: vehiclesSchema.min(1)
})
