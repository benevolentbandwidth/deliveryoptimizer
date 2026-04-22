import { geocodeAddress } from "@/app/components/AddressGeocoder/utils/nominatim";
import { secondsToTimeAMPM } from "@/app/components/AddressGeocoder/utils/timeConversion";
import { bufferSecondsToLabel } from "@/app/edit/utils/csvParserUtils";
import type { DeliveryInput } from "@/lib/types/delivery.types";
import type { OptimizeRequest } from "@/lib/types/optimize.types";
import type { VehicleInput } from "@/lib/types/vehicle.types";

import {
  addressCardToDeliveryInput,
  vehicleRowToVehicleInput,
} from "./optimizeMapper";
import type {
  AddressCard,
  CapacityUnit,
  LockedVehicleRow,
  VehicleRow,
} from "../types/delivery";

function isLockedVehicleRow(vehicle: VehicleRow): vehicle is LockedVehicleRow {
  return vehicle.locked && vehicle.type !== "" && vehicle.capacityUnit !== "";
}

export async function mapEditStateToOptimizeRequest(
  vehicles: VehicleRow[],
  addresses: AddressCard[]
): Promise<OptimizeRequest> {
  const unlockedVehicle = vehicles.find((vehicle) => !vehicle.locked);
  const unlockedAddress = addresses.find((address) => !address.locked);

  if (unlockedVehicle || unlockedAddress) {
    throw new Error("Please confirm all vehicles and addresses before exporting.");
  }

  if (vehicles.length === 0) {
    throw new Error("At least one vehicle is required to export a session.");
  }

  if (addresses.length === 0) {
    throw new Error("At least one delivery address is required to export a session.");
  }

  const lockedVehicles = vehicles.filter(isLockedVehicleRow);
  if (lockedVehicles.length !== vehicles.length) {
    throw new Error("One or more vehicles are missing type or capacity unit.");
  }

  const units = [...new Set(lockedVehicles.map((vehicle) => vehicle.capacityUnit))];
  if (units.length !== 1) {
    throw new Error("All vehicles must use the same capacity unit to export a session.");
  }

  const demandType = units[0] as CapacityUnit;
  const vehicleInputs: VehicleInput[] = [];

  for (const vehicle of lockedVehicles) {
    const location = await geocodeAddress(vehicle.startLocation);

    if (!location) {
      throw new Error(`Could not geocode vehicle start location "${vehicle.startLocation}".`);
    }

    vehicleInputs.push(vehicleRowToVehicleInput(vehicle, location));
  }

  const deliveryInputs: DeliveryInput[] = [];

  for (const address of addresses) {
    const location = await geocodeAddress(address.recipientAddress);

    if (!location) {
      throw new Error(`Could not geocode delivery address "${address.recipientAddress}".`);
    }

    deliveryInputs.push(addressCardToDeliveryInput(address, location, demandType));
  }

  return {
    vehicles: vehicleInputs,
    deliveries: deliveryInputs,
  };
}

export function mapOptimizeRequestToEditState(request: OptimizeRequest): {
  vehicles: VehicleRow[];
  addresses: AddressCard[];
} {
  if (request.vehicles.length === 0) {
    throw new Error("Session file does not contain any vehicles.");
  }

  if (request.deliveries.length === 0) {
    throw new Error("Session file does not contain any deliveries.");
  }

  return {
    vehicles: request.vehicles.map(mapVehicleInputToRow),
    addresses: request.deliveries.map(mapDeliveryInputToCard),
  };
}

function mapVehicleInputToRow(vehicle: VehicleInput): VehicleRow {
  return {
    id: vehicle.id,
    locked: true,
    editingExisting: false,
    name: vehicle.driverName ?? "",
    startLocation: formatLocation(vehicle.startLocation.lat, vehicle.startLocation.lng),
    type: vehicle.vehicleType,
    capacityUnit: vehicle.capacity.type,
    capacity: vehicle.capacity.value,
    available: true,
    departureTime:
      vehicle.departureTime != null ? secondsToTimeAMPM(vehicle.departureTime) : "",
  };
}

function mapDeliveryInputToCard(delivery: DeliveryInput): AddressCard {
  const firstWindow = delivery.timeWindows?.[0];
  const start =
    firstWindow && firstWindow[0] > 0 ? secondsToTimeAMPM(firstWindow[0]) : "";
  const end =
    firstWindow && firstWindow[1] < 86400 ? secondsToTimeAMPM(firstWindow[1]) : "";

  return {
    id: delivery.id,
    locked: true,
    editingExisting: false,
    recipientAddress:
      delivery.address ?? formatLocation(delivery.location.lat, delivery.location.lng),
    timeBuffer: bufferSecondsToLabel(String(delivery.bufferTime ?? 0)),
    deliveryTimeStart: start,
    deliveryTimeEnd: end,
    deliveryQuantity: delivery.demand.value,
    notes: delivery.notes ?? "",
  };
}

function formatLocation(lat: number, lng: number) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
