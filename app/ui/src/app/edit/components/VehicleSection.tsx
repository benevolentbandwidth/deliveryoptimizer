"use client";

/**
 * Vehicle grid: column headers plus one VehicleRow per vehicle, and an Add control below.
 */

import VehicleRow from "./VehicleRow";
import type { VehicleRow as VehicleRowType } from "../types/delivery";
import {
  DESKTOP_VEHICLE_GRID_CLASS,
  VEHICLE_ADD_DISABLED,
  VEHICLE_ADD_ENABLED,
  VEHICLE_GRID_WRAP,
  VEHICLE_HEADER_CELL_CENTER,
  VEHICLE_HEADER_CELL_START,
  VEHICLE_SECTION_TITLE,
} from "../formStyles";

type VehicleSectionProps = {
  vehicles: VehicleRowType[];
  addVehicle: () => void;
  updateVehicle: <K extends keyof VehicleRowType>(id: number, key: K, value: VehicleRowType[K]) => void;
  deleteVehicle: (id: number) => void;
  unlockVehicle: (id: number) => void;
  confirmVehicle: (id: number) => void;
  touchedIds: Set<number>;
  allVehiclesLocked: boolean;
  activeVehicleIsValid: boolean;
  geocodeFailedVehicleIds: number[];
  outOfRegionVehicleIds: number[];
};

export default function VehicleSection({
  vehicles,
  addVehicle,
  updateVehicle,
  deleteVehicle,
  unlockVehicle,
  confirmVehicle,
  touchedIds,
  allVehiclesLocked,
  activeVehicleIsValid,
  geocodeFailedVehicleIds,
  outOfRegionVehicleIds,
}: VehicleSectionProps) {
  const addEnabled = allVehiclesLocked || activeVehicleIsValid;
  const geocodeFailedSet = new Set(geocodeFailedVehicleIds);
  const outOfRegionSet = new Set(outOfRegionVehicleIds);

  return (
    <section>
      <h2 className={VEHICLE_SECTION_TITLE}>Enter vehicle details</h2>

      {/* Desktop: headers + vehicle rows in one grid */}
      <div className={`${VEHICLE_GRID_WRAP} ${DESKTOP_VEHICLE_GRID_CLASS}`}>
        <span className={VEHICLE_HEADER_CELL_START}>Name</span>
        <span className={VEHICLE_HEADER_CELL_START}>Start Location</span>
        <span className={VEHICLE_HEADER_CELL_START}>Type</span>
        <span className={VEHICLE_HEADER_CELL_START}>Capacity Unit</span>
        <span className={VEHICLE_HEADER_CELL_START}>Capacity</span>
        <span className={VEHICLE_HEADER_CELL_CENTER}>Available</span>
        <span className={VEHICLE_HEADER_CELL_START}>Departure Time</span>
        <span />
        {vehicles.map((v) => (
          <VehicleRow
            key={`vehicle-${v.id}`}
            layout="desktop"
            vehicle={v}
            vehiclesCount={vehicles.length}
            updateVehicle={updateVehicle}
            deleteVehicle={deleteVehicle}
            unlockVehicle={unlockVehicle}
            confirmVehicle={confirmVehicle}
            vehicleTouched={touchedIds.has(v.id)}
            geocodeFailed={geocodeFailedSet.has(v.id)}
            outOfRegionFailed={outOfRegionSet.has(v.id)}
          />
        ))}
      </div>

      {/* Mobile: stacked cards */}
      <div className="lg:hidden space-y-6">
        {vehicles.map((v) => (
          <VehicleRow
            key={`vehicle-mobile-${v.id}`}
            layout="mobile"
            vehicle={v}
            vehiclesCount={vehicles.length}
            updateVehicle={updateVehicle}
            deleteVehicle={deleteVehicle}
            unlockVehicle={unlockVehicle}
            confirmVehicle={confirmVehicle}
            vehicleTouched={touchedIds.has(v.id)}
            geocodeFailed={geocodeFailedSet.has(v.id)}
            outOfRegionFailed={outOfRegionSet.has(v.id)}
          />
        ))}
      </div>

      {/* Add button */}
      <div className="mt-4">
        <button type="button"
          onClick={addVehicle}
          disabled={!addEnabled}
          className={addEnabled ? VEHICLE_ADD_ENABLED : VEHICLE_ADD_DISABLED}
        >
          Add
        </button>
      </div>
    </section>
  );
}
