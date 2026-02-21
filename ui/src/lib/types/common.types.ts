export type Location = {
  lat: number
  lng: number
}

export type Load = {
  type: "units" | "weight" | "volume"
  value: number
}