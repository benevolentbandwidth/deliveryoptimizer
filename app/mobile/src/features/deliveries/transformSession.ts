import type { DriverRoute, DeliveryStop, OptimizeRequestLike } from './types';

export function transformSessionToDriverRoute(input: OptimizeRequestLike): DriverRoute {
  const deliveries = input.deliveries || [];
  const firstVehicle = input.vehicles?.[0];

  const stops: DeliveryStop[] = deliveries.map((delivery, index) => {
    if (delivery.location == null) {
      console.warn(
        `Delivery ${delivery.id} is missing coordinates; navigation will fall back to (0, 0).`
      );
    }

    return {
      id: String(delivery.id),
      stopNumber: index + 1,
      address: delivery.address || 'No address provided',
      customerName: delivery.recipientName || `Recipient ${index + 1}`,
      phoneNumber: delivery.phoneNumber,
      packageCount: delivery.demand?.value || 1,
      notes: delivery.notes || '',
      status: 'pending',
      lat: delivery.location?.lat || 0,
      lng: delivery.location?.lng || 0,
      completedAt: undefined,
      failureReason: undefined,
    };
  });

  return {
    driverName: firstVehicle?.driverName || 'Driver Assist',
    routeLabel: `Route ${firstVehicle?.id || '1'} · ${stops.length} stops`,
    stops,
  };
}
