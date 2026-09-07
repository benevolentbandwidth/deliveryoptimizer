import type { DeliveryStop } from "./types";

type PendingDeliveryStopInput = {
  id: string | number;
  index: number;
  address?: string;
  customerName?: string;
  customerNameFallback?: string;
  phoneNumber?: string;
  packageCount?: number;
  notes?: string;
  lat?: number;
  lng?: number;
};

export function createPendingDeliveryStop({
  id,
  index,
  address,
  customerName,
  customerNameFallback = `Stop ${index + 1}`,
  phoneNumber,
  packageCount,
  notes,
  lat,
  lng,
}: PendingDeliveryStopInput): DeliveryStop {
  return {
    id: String(id),
    stopNumber: index + 1,
    address: address || "No address provided",
    customerName: customerName || customerNameFallback,
    phoneNumber,
    packageCount: packageCount ?? 1,
    notes: notes || "",
    status: "pending",
    lat: lat ?? 0,
    lng: lng ?? 0,
    completedAt: undefined,
    failureReason: undefined,
  };
}
