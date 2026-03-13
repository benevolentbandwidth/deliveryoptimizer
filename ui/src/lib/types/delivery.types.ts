import { z } from "zod"
import { deliverySchema } from "../validation/delivery.schema"

export type DeliveryInput = z.infer<typeof deliverySchema>

export type Delivery = {
  id: string
  location: [number, number]
  serviceTime?: number
  deliverySize: number[]
  timeWindows?: [number, number][]
}
