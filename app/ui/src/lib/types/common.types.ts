export type Location = {
  lat: number
  lng: number
}

export type Load = {
  type: "units" | "lbs" | "kgs" | "cubic_feet"
  value: number
}