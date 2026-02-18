// Defining the input shape (mock JSON file)
// Then converting it into the output shape defined in types.ts (full Route and Stop objects) so the rest of the app can use it

import type { Route, Stop } from "../types";

export interface MockRouteStop { // Defining the shape of a single stop in the mock route
  id: string;
  lat: number;
  lng: number;
  address: string;
  status: string;
  sequence: number;
}

export interface MockRouteJson { // Defining shape of mock_route.json file
  stops: MockRouteStop[];
}

export function mockRouteToRoute(data: MockRouteJson): Route { // Converting the mock route data into a Route object with stops
  const stops: Stop[] = data.stops.map((s) => ({
    id: s.id,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    sequence: s.sequence,
    capacityUsed: 0,
    timeWindow: { kind: "by" as const, time: "12:00" },
    deliveryNotes: "",
  }));
  return {
    vehicleId: "mock-vehicle-1",
    driverName: "Mock Route",
    stops,
  };
}
