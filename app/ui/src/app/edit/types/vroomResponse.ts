/** Raw VROOM API response shape as returned by the C++ backend via /api/optimize. */

export interface VroomStep {
  type: "start" | "job" | "end";
  job?: number;
  job_external_id?: string;    // string form of AddressCard.id
  location: [number, number];  // [lng, lat] — GeoJSON order
  arrival: number;             // seconds from midnight (local day-start)
  service?: number;            // dwell time in seconds
  load?: number[];
}

export interface VroomRoute {
  vehicle: number;
  vehicle_external_id: string; // string form of VehicleRow.id
  steps: VroomStep[];
  distance: number;            // meters
  duration: number;            // seconds
}

export interface VroomResponse {
  routes: VroomRoute[];
  unassigned?: { id: number; job_external_id?: string }[];
}
