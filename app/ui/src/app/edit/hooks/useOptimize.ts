/**
 * Orchestrates the full optimize flow: validate → geocode → map → POST to /api/optimize.
 */

import { useState, useCallback } from "react";
import { geocodeAddress } from "@/app/components/AddressGeocoder/utils/nominatim";
import { vehicleRowToVehicleInput, addressCardToDeliveryInput } from "../utils/optimizeMapper";
import type { VehicleRow, AddressCard, LockedVehicleRow } from "../types/delivery";
import type { CapacityUnit } from "../types/delivery";

// Rough bounding boxes for the three supported states.
const SUPPORTED_REGIONS = [
  { name: "CA", latMin: 32.5,  latMax: 42.0,  lngMin: -124.5, lngMax: -114.1 },
  { name: "TX", latMin: 25.8,  latMax: 36.5,  lngMin: -106.7, lngMax:  -93.5 },
  { name: "FL", latMin: 24.4,  latMax: 31.0,  lngMin:  -87.6, lngMax:  -80.0 },
] as const;

function isInSupportedRegion(lat: number, lng: number): boolean {
  return SUPPORTED_REGIONS.some(
    (r) => lat >= r.latMin && lat <= r.latMax && lng >= r.lngMin && lng <= r.lngMax
  );
}

// ensure that vehicleType and capacityUnit are not empty
function isLocked(v: VehicleRow): v is LockedVehicleRow {
  return v.locked && v.type !== "" && v.capacityUnit !== "";
}
export function useOptimize(vehicles: VehicleRow[], addresses: AddressCard[]) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [geocodeFailedAddressIds, setGeocodeFailedAddressIds] = useState<number[]>([]);
  const [geocodeFailedVehicleIds, setGeocodeFailedVehicleIds] = useState<number[]>([]);
  const [outOfRegionAddressIds, setOutOfRegionAddressIds] = useState<number[]>([]);
  const [outOfRegionVehicleIds, setOutOfRegionVehicleIds] = useState<number[]>([]);

  // TODO: Result will be updated to store the result of the optimize request
  const [result, setResult] = useState<unknown>(null);

  const optimize = useCallback(async () => {
    setOptimizeError(null);
    setGeocodeFailedAddressIds([]);
    setGeocodeFailedVehicleIds([]);
    setOutOfRegionAddressIds([]);
    setOutOfRegionVehicleIds([]);

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
    
    // 4. Check that all vehicles are locked and have a type and capacity unit.
    const lockedVehicles = availableVehicles.filter(isLocked);

    if (lockedVehicles.length !== availableVehicles.length) {
      setOptimizeError("One or more vehicles are missing type or capacity unit.");
      return;
    }

    // 5. Validate that all active vehicles share the same capacity unit
    const units = [...new Set(availableVehicles.map((v) => v.capacityUnit))];
    if (units.length > 1) {
      setOptimizeError("All vehicles must use the same capacity unit to optimize.");
      return;
    }
    const demandType = units[0] as CapacityUnit;

    // 6. Geocode all vehicle start locations and delivery addresses, collecting every failure.
    setIsOptimizing(true);
    try {
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
      
      // 7. Reject any coordinate that falls outside CA, TX, or FL.
      const badVehicleAddresses: { id: number; location: string }[] = [];
      for (const [id, loc] of vehicleLocations) {
        if (!isInSupportedRegion(loc.lat, loc.lng)) {
          const v = availableVehicles.find((v) => v.id === id)!;
          badVehicleAddresses.push({ id, location: v.startLocation });
        }
      }
      const badDeliveryAddresses: { id: number; address: string }[] = [];
      for (const [id, loc] of addressLocations) {
        if (!isInSupportedRegion(loc.lat, loc.lng)) {
          const a = addresses.find((a) => a.id === id)!;
          badDeliveryAddresses.push({ id, address: a.recipientAddress });
        }
      }

      if (badVehicleAddresses.length > 0 || badDeliveryAddresses.length > 0) {
        setOutOfRegionVehicleIds(badVehicleAddresses.map((f) => f.id));
        setOutOfRegionAddressIds(badDeliveryAddresses.map((f) => f.id));
        const allBad = [
          ...badVehicleAddresses.map((f) => f.location),
          ...badDeliveryAddresses.map((f) => f.address),
        ];
        const shown = allBad.slice(0, 3);
        const overflow = allBad.length - shown.length;
        const list = shown.map((s) => `"${s}"`).join(", ");
        const suffix =  overflow > 0 ? `, and ${overflow} more` : ""; 
        setOptimizeError(`Unsupported region(s):${list}${suffix}. We currently only support CA, TX, and FL.`);
        return;
      }

      // 8. Map form data to API types.
      const vehicleInputs = lockedVehicles.map((v) =>
        vehicleRowToVehicleInput(v, vehicleLocations.get(v.id)!)
      );

      const deliveryInputs = addresses.map((a) =>
        addressCardToDeliveryInput(a, addressLocations.get(a.id)!, demandType)
      ).filter((d) => d !== undefined);

      // 9. POST to /api/optimize.
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

      // 10. Store result for the caller to consume.
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
    outOfRegionAddressIds,
    outOfRegionVehicleIds,
    result,
  };
}
