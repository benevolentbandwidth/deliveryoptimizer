import { VehicleInput } from "./vehicle.types"
import { DeliveryInput } from "./delivery.types"

export type OptimizeRequest = {
  vehicles: VehicleInput[]
  deliveries: DeliveryInput[]
}