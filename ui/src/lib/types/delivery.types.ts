import { Location, Load } from "./common.types"

export type DeliveryInput = {
  id: number
  address?: string  // Not required for VROOM
  location: Location
  bufferTime?: number
  demand: Load
  timeWindows?: [number, number][]
}

export type Delivery = {
  id: number
  location: [number, number]
  serviceTime?: number
  deliverySize: number[]
  timeWindows?: [number, number][]
}