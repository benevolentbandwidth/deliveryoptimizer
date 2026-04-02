/**
 * Orchestrates the full optimize flow: validate → geocode → map → POST to /api/optimize.
 */

import { useState, useCallback } from "react";
import { geocodeAddress } from "@/app/components/AddressGeocoder/utils/nominatim";
import { vehicleRowToVehicleInput, addressCardToDeliveryInput } from "../utils/optimizeMapper";
import type { VehicleRow, AddressCard } from "../types/delivery";

export function useOptimize(vehicles: VehicleRow[], addresses: AddressCard[]) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  const optimize = useCallback(async () => {
    setOptimizeError(null);

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
      // 4. Geocode vehicle start locations and delivery addresses sequentially.
      const vehicleLocations: Map<number, { lat: number; lng: number }> = new Map();
      for (const v of availableVehicles) {
        const loc = await geocodeAddress(v.startLocation);
        if (!loc) {
          setOptimizeError(`Could not geocode: "${v.startLocation}". Try a more specific address.`);
          return;
        }
        vehicleLocations.set(v.id, loc);
      }

      const addressLocations: Map<number, { lat: number; lng: number }> = new Map();
      for (const a of addresses) {
        const loc = await geocodeAddress(a.recipientAddress);
        if (!loc) {
          setOptimizeError(`Could not geocode: "${a.recipientAddress}". Try a more specific address.`);
          return;
        }
        addressLocations.set(a.id, loc);
      }

      // 5. Map form data to API types.
      const vehicleInputs = availableVehicles.map((v) =>
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

      const data: unknown = await response.json();

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

  const clearOptimizeError = useCallback(() => setOptimizeError(null), []);

  return { optimize, isOptimizing, optimizeError, clearOptimizeError, result };
}
