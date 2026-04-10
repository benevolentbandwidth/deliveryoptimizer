/**
 * Vehicle list state: same lock/edit/confirm pattern as addresses, without pagination.
 */

import { useState, useCallback } from "react";
import type { VehicleRow } from "../types/delivery";

function isVehicleValid(v: VehicleRow): boolean {
  return (
    v.name.trim() !== "" &&
    (v.startLocation ?? "").trim() !== "" &&
    v.type !== "" &&
    v.capacityUnit !== "" &&
    v.capacity > 0 &&
    v.departureTime.trim() !== ""
  );
}

export function useVehicles() {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([
    {
      id: 1,
      locked: false,
      editingExisting: false,
      name: "",
      startLocation: "",
      type: "",
      capacityUnit: "",
      capacity: 0,
      available: true,
      departureTime: "",
    },
  ]);

  // Set of vehicle IDs whose fields should show validation errors.
  const [touchedIds, setTouchedIds] = useState<Set<number>>(new Set());

  const activeVehicle = vehicles.find((v) => !v.locked);
  const activeVehicleIsValid = !!activeVehicle && isVehicleValid(activeVehicle);
  const allVehiclesLocked = vehicles.length > 0 && vehicles.every((v) => v.locked);

  const updateVehicle = useCallback(<K extends keyof VehicleRow>(
    id: number,
    key: K,
    value: VehicleRow[K]
  ) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [key]: value } : v))
    );
  }, []);

  const addVehicle = useCallback(() => {
    setVehicles((prev) => {
      const active = prev.find((v) => !v.locked);
      const allLocked = prev.length > 0 && prev.every((v) => v.locked);
  
      if (!allLocked && !(active && isVehicleValid(active))) {
        if (active) setTouchedIds((t) => new Set([...t, active.id]));
        return prev;
      }
  
      setTouchedIds(new Set());
      const newId = prev.reduce((max, v) => Math.max(max, v.id), 0) + 1;
  
      return [
        ...prev.map((v) => (v.locked ? v : { ...v, locked: true, editingExisting: false })),
        {
          id: newId,
          locked: false,
          editingExisting: false,
          name: "",
          startLocation: "",
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
    setTouchedIds((t) => {
      const next = new Set(t);
      next.delete(id);
      return next;
    });
  }, []);

  // Edit mode for a locked row: clear any stale validation state for the row.
  const unlockVehicle = useCallback((id: number) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, locked: false, editingExisting: true } : v))
    );
    setTouchedIds((t) => {
      const next = new Set(t);
      next.delete(id);
      return next;
    });
  }, []);

  // Validate required fields; on failure mark only this row, on success lock it.
  const confirmVehicle = useCallback((id: number) => {
    setVehicles((prev) => {
      const v = prev.find((x) => x.id === id);
      if (!v) return prev;
  
      if (!isVehicleValid(v)) {
        setTouchedIds((t) => new Set([...t, id]));
        return prev;
      }
  
      setTouchedIds((t) => {
        const next = new Set(t);
        next.delete(id);
        return next;
      });
      return prev.map((x) =>
        x.id === id ? { ...x, locked: true, editingExisting: false } : x
      );
    });
  }, []);

  return {
    vehicles,
    updateVehicle,
    addVehicle,
    deleteVehicle,
    unlockVehicle,
    confirmVehicle,
    touchedIds,
    activeVehicleIsValid,
    allVehiclesLocked,
  };
}
