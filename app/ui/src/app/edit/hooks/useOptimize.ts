/**
 * Orchestrates the full optimize flow: validate → geocode → map → POST to /api/optimize.
 */

import { useState, useCallback } from "react";
import { geocodeAddress } from "@/app/components/AddressGeocoder/utils/nominatim";
import { vehicleRowToVehicleInput, addressCardToDeliveryInput } from "../utils/optimizeMapper";
import type { VehicleRow, AddressCard, LockedVehicleRow } from "../types/delivery";

// ensure that vehicleType and capacityUnit are not empty
function isLocked(v: VehicleRow): v is LockedVehicleRow {
  return v.locked && v.type !== "" && v.capacityUnit !== "";
}
export function useOptimize(vehicles: VehicleRow[], addresses: AddressCard[]) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [geocodeFailedAddressIds, setGeocodeFailedAddressIds] = useState<number[]>([]);
  const [geocodeFailedVehicleIds, setGeocodeFailedVehicleIds] = useState<number[]>([]);
  const [result, setResult] = useState<unknown>(null);

  const optimize = useCallback(async () => {
    setOptimizeError(null);
    setGeocodeFailedAddressIds([]);
    setGeocodeFailedVehicleIds([]);

    // 1. All rows must be locked before optimizing.
    const unlockedVehicle = vehicles.find((v) => !v.locked);
    const unlockedAddress = addresses.find((a) => !a.locked);
    if (unlockedVehicle || unlockedAddress) {
      setOptimizeError("Please confirm all vehicles and addresses before optimizing.");
      return;
    }

    // 2. Filter out unavailable vehicles.
    const availableVehicles = vehicles.filter((v) => v.available);

    // 3. Must have at least one vehicle and one address.
    if (availableVehicles.length === 0) {
      setOptimizeError("At least one available vehicle is required.");
      return;
    }
    if (addresses.length === 0) {
      setOptimizeError("At least one delivery address is required.");
      return;
    }

    setIsOptimizing(true);
    try {
      // 4. Geocode all vehicle start locations and delivery addresses, collecting every failure.
      const vehicleLocations: Map<number, { lat: number; lng: number }> = new Map();
      const failedVehicles: { id: number; location: string }[] = [];
      for (const v of availableVehicles) {
        const loc = await geocodeAddress(v.startLocation);
        if (!loc) {
          failedVehicles.push({ id: v.id, location: v.startLocation });
        } else {
          vehicleLocations.set(v.id, loc);
        }
      }

      const addressLocations: Map<number, { lat: number; lng: number }> = new Map();
      const failedAddresses: { id: number; address: string }[] = [];
      for (const a of addresses) {
        const loc = await geocodeAddress(a.recipientAddress);
        if (!loc) {
          failedAddresses.push({ id: a.id, address: a.recipientAddress });
        } else {
          addressLocations.set(a.id, loc);
        }
      }

      if (failedVehicles.length > 0 || failedAddresses.length > 0) {
        setGeocodeFailedVehicleIds(failedVehicles.map((f) => f.id));
        setGeocodeFailedAddressIds(failedAddresses.map((f) => f.id));
        const allFailed = [
          ...failedVehicles.map((f) => f.location),
          ...failedAddresses.map((f) => f.address),
        ];
        const shown = allFailed.slice(0, 3);
        const overflow = allFailed.length - shown.length;
        const list = shown.map((s) => `"${s}"`).join(", ");
        const suffix = overflow > 0 ? `, and ${overflow} more` : "";
        setOptimizeError(`Could not geocode: ${list}${suffix}. Try more specific addresses.`);
        return;
      }

      // 5. Map form data to API types.
      const vehicleInputs = availableVehicles.filter(isLocked).map((v) =>
        vehicleRowToVehicleInput(v, vehicleLocations.get(v.id)!)
      );
      
      const deliveryInputs = addresses.map((a) =>
        addressCardToDeliveryInput(a, addressLocations.get(a.id)!)
      );

      // 6. POST to /api/optimize.
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicles: vehicleInputs, deliveries: deliveryInputs }),
      });

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        setOptimizeError("Received invalid response from server.");
        return;
      }
      
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Optimization failed.";
        setOptimizeError(message);
        return;
      }

      // 7. Store result for the caller to consume.
      setResult(data);
    } catch {
      setOptimizeError("Network error. Please check your connection and try again.");
    } finally {
      setIsOptimizing(false);
    }
  }, [vehicles, addresses]);

  // Only clears the error message; geocode failure highlights persist until the next optimize run.
  const clearOptimizeError = useCallback(() => {
    setOptimizeError(null);
  }, []);

  return {
    optimize,
    isOptimizing,
    optimizeError,
    clearOptimizeError,
    geocodeFailedAddressIds,
    geocodeFailedVehicleIds,
    result,
  };
}
