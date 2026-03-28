/**
 * Vehicle list state: same lock/edit/confirm pattern as addresses, without pagination.
 */

import { useState, useCallback } from "react";
import type { VehicleRow } from "../types/delivery";

export function useVehicles() {
  // Start with one empty editable row; IDs increase as rows are added.
  const [vehicles, setVehicles] = useState<VehicleRow[]>([
    {
      id: 1,
      locked: false,
      editingExisting: false,
      name: "",
      type: "",
      capacityUnit: "",
      capacity: 0,
      available: true,
      departureTime: "",
    },
  ]);

  const [vehicleTouched, setVehicleTouched] = useState(false);

  // Unlocked row must be valid before adding another vehicle.
  const activeVehicle = vehicles.find((v) => !v.locked);
  const activeVehicleIsValid =
    !!activeVehicle &&
    activeVehicle.name.trim() !== "" &&
    activeVehicle.type !== "" &&
    activeVehicle.capacityUnit !== "" &&
    activeVehicle.capacity > 0 &&
    activeVehicle.departureTime.trim() !== "";

  const allVehiclesLocked = vehicles.length > 0 && vehicles.every((v) => v.locked);

  // Patch a single field on one vehicle row.
  const updateVehicle = useCallback(<K extends keyof VehicleRow>(
    id: number,
    key: K,
    value: VehicleRow[K]
  ) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [key]: value } : v))
    );
  }, []);

  // Lock the open row if needed, then append a fresh editable vehicle.
  // All logic runs inside the functional updater so the ID is always computed
  // from the latest state and the callback never needs to be recreated.
  const addVehicle = useCallback(() => {
    setVehicles((prev) => {
      const active = prev.find((v) => !v.locked);
      const allLocked = prev.length > 0 && prev.every((v) => v.locked);
      const isValid =
        !!active &&
        active.name.trim() !== "" &&
        active.type !== "" &&
        active.capacityUnit !== "" &&
        active.capacity > 0 &&
        active.departureTime.trim() !== "";

      if (!allLocked && !isValid) {
        setVehicleTouched(true);
        return prev;
      }

      setVehicleTouched(false);
      const newId = prev.reduce((max, v) => Math.max(max, v.id), 0) + 1;

      return [
        ...prev.map((v) => (v.locked ? v : { ...v, locked: true, editingExisting: false })),
        {
          id: newId,
          locked: false,
          editingExisting: false,
          name: "",
          type: "",
          capacityUnit: "",
          capacity: 0,
          available: true,
          departureTime: "",
        },
      ];
    });
  }, []);

  // Always keep at least one vehicle in the list.
  const deleteVehicle = useCallback((id: number) => {
    setVehicles((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((v) => v.id !== id);
    });
  }, []);

  // Edit mode for a locked row: full-width blue panel with Confirm.
  const unlockVehicle = useCallback((id: number) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, locked: false, editingExisting: true } : v))
    );
  }, []);

  // Validate required fields, then collapse the row back to the gray summary cells.
  const confirmVehicle = useCallback((id: number) => {
    setVehicles((prev) => {
      const v = prev.find((x) => x.id === id);
      if (!v) return prev;
      const valid =
        v.name.trim() !== "" &&
        v.type !== "" &&
        v.capacityUnit !== "" &&
        v.capacity > 0 &&
        v.departureTime.trim() !== "";
      if (!valid) {
        setVehicleTouched(true);
        return prev;
      }
      setVehicleTouched(false);
      return prev.map((x) => (x.id === id ? { ...x, locked: true, editingExisting: false } : x));
    });
  }, []);

  // Public API for the vehicle grid.
  return {
    vehicles,
    updateVehicle,
    addVehicle,
    deleteVehicle,
    unlockVehicle,
    confirmVehicle,
    vehicleTouched,
    activeVehicleIsValid,
    allVehiclesLocked,
  };
}
