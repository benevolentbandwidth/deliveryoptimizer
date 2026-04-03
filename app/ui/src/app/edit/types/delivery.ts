/** Vehicle type options. */
export type VehicleType = "truck" | "car" | "bicycle";

/** Unit of measurement for vehicle capacity. */
export type CapacityUnit = "units" | "lbs" | "kgs" | "volume";

/** One fleet vehicle row: identity, capacity, availability, and departure time. */
export type VehicleRow = {
  id: number;
  locked: boolean;
  editingExisting: boolean;
  name: string;
  startLocation: string;
  /** Empty string represents "not yet selected". */
  type: VehicleType | "";
  /** Empty string represents "not yet selected". */
  capacityUnit: CapacityUnit | "";
  capacity: number;
  available: boolean;
  departureTime: string;
};
