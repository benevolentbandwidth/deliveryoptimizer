import { Location, Load } from "./common.types"

export type DeliveryInput = {
  id: number
  recipientName?: string
  phoneNumber?: string
  address?: string // Not required for VROOM
  notes?: string
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
