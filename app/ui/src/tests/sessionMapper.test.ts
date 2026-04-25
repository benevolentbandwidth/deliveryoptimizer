import { describe, expect, it } from "vitest";

import { mapOptimizeRequestToEditState } from "@/app/edit/utils/sessionMapper";
import type { OptimizeRequest } from "@/lib/types/optimize.types";

describe("mapOptimizeRequestToEditState", () => {
  it("restores time windows into delivery start/end fields and hydrates cached locations", () => {
    const request: OptimizeRequest = {
      vehicles: [
        {
          id: 1,
          vehicleType: "car",
          driverName: "Driver 1",
          startLocation: { lat: 34.052235, lng: -118.243683 },
          capacity: { type: "units", value: 10 },
          departureTime: 32400,
          returnTime: 86400,
        },
      ],
      deliveries: [
        {
          id: 1,
          address: "123 Main St",
          notes: "Leave at side door",
          location: { lat: 36.169941, lng: -115.139832 },
          bufferTime: 300,
          demand: { type: "units", value: 3 },
          timeWindows: [[32400, 61200]],
        },
      ],
    };

    const state = mapOptimizeRequestToEditState(request);

    expect(state.vehicles[0]).toMatchObject({
      name: "Driver 1",
      cachedLocation: { lat: 34.052235, lng: -118.243683 },
      departureTime: "9:00 AM",
    });

    expect(state.addresses[0]).toMatchObject({
      recipientAddress: "123 Main St",
      cachedLocation: { lat: 36.169941, lng: -115.139832 },
      deliveryTimeStart: "9:00 AM",
      deliveryTimeEnd: "5:00 PM",
      notes: "Leave at side door",
    });
  });
});
