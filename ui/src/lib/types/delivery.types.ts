import { Location, Load } from "./common.types"

export type DeliveryInput = {
  id: string
  address?: string
  location: Location
  bufferTime?: number
  demand: Load
  timeWindows?: [number, number][]

}

export type Delivery = {
  id: string
  location: [number, number]
  serviceTime?: number
  deliverySize: number[]
  timeWindows?: [number, number][]
}