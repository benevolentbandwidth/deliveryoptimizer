// Results page only: types for map, route list, and edits
// Edit page input: addresses, time buffers, vehicle capacity, delivery times, notes.
// VROOM/OSRM output: route order, coordinates, travel times.

// Decipher between whether a delivery is a deadline (by) or an exact time (at)
export type DeliveryTimeType = "by" | "at";

// Concatenate the delivery time type and the time
export interface TimeWindow {
  kind: DeliveryTimeType; // "by" or "at"
  time: string; // e.g. time is 11:00
}

// Data for a single delivery stop
export interface Stop {
  id: string; // id of the stop (e.g. stop-1)
  address: string; // address of the stop
  lat: number; // coordinates for the stop (latitude and longitude) that comes from OSRM results
  lng: number;
  sequence: number; // order in the route that comes from OSRM results
  capacityUsed: number; // how much capacity is used for the stop (e.g. 5 boxes)
  timeWindow: TimeWindow; // time type and time for the stop
  deliveryNotes: string; // notes for the stop
}

// Data that a single route contains (one driver, their stops in order, and the path to draw for the route)
export interface Route {
  vehicleId: string; // id of the vehicle (e.g. vehicle-1)
  driverName: string; // name of the driver (e.g. Jim)
  stops: Stop[]; // list of stops for the route
  geometry?: { lat: number; lng: number }[]; // ordered list of coordinates for the route (used for drawing the route on the map)
}
