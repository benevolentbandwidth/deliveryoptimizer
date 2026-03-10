import { z } from "zod"
import { vehicleSchema } from "../validation/vehicle.schema"

export type VehicleInput = z.infer<typeof vehicleSchema>

export type Vehicle = {
  id: string
  start: [number, number]
  end?: [number, number]
  capacity: number[]
  timeWindow?: [number, number]
}
