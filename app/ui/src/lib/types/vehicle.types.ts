import { Location, Load } from "./common.types"

export type VehicleInput = {
  id: string
  vehicleType: string
  startLocation: Location
  endLocation?: Location
  capacity: Load
  departureTime?: number
  returnTime?: number
}

export type Vehicle = {
  id: string
  start: [number, number]
  end?: [number, number]
  capacity: number[]
  timeWindow?: [number, number]
}