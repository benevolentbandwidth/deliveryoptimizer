import { Location, Load } from "./common.types"

export type VehicleType = "truck" | "car" | "bicycle"

export type VehicleInput = {
  id: number
  vehicleType: VehicleType
  driverName?: string
  startLocation: Location
  endLocation?: Location
  capacity: Load
  departureTime?: number
  returnTime?: number
}

export type Vehicle = {
  id: number
  profile: VehicleType
  start: [number, number]
  end?: [number, number]
  capacity: number[]
  departureTime?: number
  returnTime?: number
}
