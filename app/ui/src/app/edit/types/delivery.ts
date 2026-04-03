/** Vehicle type options. */
export type VehicleType = "truck" | "car" | "bicycle";

/** Unit of measurement for vehicle capacity. */
export type CapacityUnit = "units" | "lbs" | "kgs" | "cubic_feet";

/** A VehicleRow that has passed validation and been locked. */
export type LockedVehicleRow = VehicleRow & {
  type: VehicleType;
  capacityUnit: CapacityUnit;
};

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

/** One stop: delivery address, timing constraints, quantity, and optional notes. */
export type AddressCard = {
  id: number;
  locked: boolean;
  editingExisting: boolean;
  recipientAddress: string;
  timeBuffer: string;
  /** Which time control is shown: single "by" time or a "between" window. */
  deliveryTimeMode: "by" | "between";
  deliveryBy: string;
  deliveryBetween: string;
  deliveryQuantity: number;
  notes: string;
};
