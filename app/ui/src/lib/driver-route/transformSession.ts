import { createPendingDeliveryStop } from "./createDeliveryStop";
import type { DriverRoute, OptimizeRequestLike } from "./types";

export function transformSessionToDriverRoute(
  input: OptimizeRequestLike,
): DriverRoute {
  // The driver PWA only needs the ordered stops and the first assigned driver.
  const deliveries = input.deliveries;
  const firstVehicle = input.vehicles[0];

  const stops = deliveries.map((delivery, index) =>
    createPendingDeliveryStop({
      id: delivery.id,
      index,
      address: delivery.address,
      customerName: delivery.recipientName,
      customerNameFallback: `Recipient ${index + 1}`,
      phoneNumber: delivery.phoneNumber,
      packageCount: delivery.demand?.value,
      notes: delivery.notes,
      lat: delivery.location?.lat,
      lng: delivery.location?.lng,
    }),
  );

  return {
    driverName: firstVehicle?.driverName || "driver_assist",
    // Keep this human-readable; it shows up in exported route summaries.
    routeLabel: `Route ${firstVehicle?.id || "1"} - ${stops.length} stops`,
    stops,
  };
}
