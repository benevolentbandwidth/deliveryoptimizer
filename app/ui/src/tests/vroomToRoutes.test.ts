import { describe, it, expect } from "vitest";
import { vroomToRoutes } from "@/app/edit/utils/vroomToRoutes";
import type { VroomResponse, VroomStep } from "@/app/edit/types/vroomResponse";
import type { VehicleRow, AddressCard } from "@/app/edit/types/delivery";

function makeVehicle(id: number, overrides: Partial<VehicleRow> = {}): VehicleRow {
  return {
    id,
    locked: true,
    editingExisting: false,
    name: `Driver ${id}`,
    startLocation: "1 Depot Rd",
    type: "car",
    capacityUnit: "units",
    capacity: 100,
    available: true,
    departureTime: "",
    ...overrides,
  };
}

function makeAddress(id: number, overrides: Partial<AddressCard> = {}): AddressCard {
  return {
    id,
    locked: true,
    editingExisting: false,
    recipientAddress: `${id} Test St`,
    timeBuffer: "",
    deliveryTimeStart: "",
    deliveryTimeEnd: "",
    deliveryQuantity: 1,
    notes: "",
    ...overrides,
  };
}

function jobStep(jobId: string, arrivalSecs: number): VroomStep {
  return { type: "job", job_external_id: jobId, location: [-74.006, 40.7128], arrival: arrivalSecs };
}

const SINGLE_STOP: VroomResponse = {
  routes: [{
    vehicle: 1,
    vehicle_external_id: "1",
    steps: [jobStep("1", 32400)],
    distance: 16093.4,
    duration: 1800,
  }],
};

describe("vroomToRoutes", () => {
  it("empty routes → []", () => {
    expect(vroomToRoutes({ routes: [] }, [], [])).toEqual([]);
  });

  it("maps vehicleId, driverName, distanceMi, estimatedTimeMinutes", () => {
    const [route] = vroomToRoutes(SINGLE_STOP, [makeVehicle(1)], [makeAddress(1)]);
    expect(route.vehicleId).toBe("1");
    expect(route.driverName).toBe("Driver 1");
    expect(route.distanceMi).toBe(10.0);
    expect(route.estimatedTimeMinutes).toBe(30);
  });

  it("arrival 32400 → stop time '9:00 AM'", () => {
    const [route] = vroomToRoutes(SINGLE_STOP, [makeVehicle(1)], [makeAddress(1)]);
    expect(route.stops[0].timeWindow.time).toBe("9:00 AM");
  });

  it("unknown job_external_id → address falls back to coordinate string", () => {
    const [route] = vroomToRoutes(SINGLE_STOP, [makeVehicle(1)], []);
    expect(route.stops[0].address).toMatch(/\d+\.\d+/);
  });

  it("unknown vehicle_external_id → fallback driver name", () => {
    const [route] = vroomToRoutes(SINGLE_STOP, [], [makeAddress(1)]);
    expect(route.driverName).toBe("Vehicle 1");
  });

  it("start + end → kind 'at'", () => {
    const [route] = vroomToRoutes(
      SINGLE_STOP,
      [makeVehicle(1)],
      [makeAddress(1, { deliveryTimeStart: "9:00 AM", deliveryTimeEnd: "5:00 PM" })]
    );
    expect(route.stops[0].timeWindow.kind).toBe("at");
  });

  it("start only → kind 'from'", () => {
    const [route] = vroomToRoutes(
      SINGLE_STOP,
      [makeVehicle(1)],
      [makeAddress(1, { deliveryTimeStart: "9:00 AM" })]
    );
    expect(route.stops[0].timeWindow.kind).toBe("from");
  });

  it("end only → kind 'by'", () => {
    const [route] = vroomToRoutes(
      SINGLE_STOP,
      [makeVehicle(1)],
      [makeAddress(1, { deliveryTimeEnd: "5:00 PM" })]
    );
    expect(route.stops[0].timeWindow.kind).toBe("by");
  });

  it("no time constraint → kind 'by'", () => {
    const [route] = vroomToRoutes(SINGLE_STOP, [makeVehicle(1)], [makeAddress(1)]);
    expect(route.stops[0].timeWindow.kind).toBe("by");
  });

  it("start/end step types are filtered out — only job steps become stops", () => {
    const response: VroomResponse = {
      routes: [{
        vehicle: 1,
        vehicle_external_id: "1",
        steps: [
          { type: "start", location: [-74.006, 40.7128], arrival: 0 },
          jobStep("1", 32400),
          { type: "end", location: [-74.006, 40.7128], arrival: 36000 },
        ],
        distance: 0,
        duration: 0,
      }],
    };
    const [route] = vroomToRoutes(response, [makeVehicle(1)], [makeAddress(1)]);
    expect(route.stops).toHaveLength(1);
  });

  it("sequence numbers are 1-based", () => {
    const response: VroomResponse = {
      routes: [{
        vehicle: 1,
        vehicle_external_id: "1",
        steps: [jobStep("1", 32400), jobStep("2", 36000)],
        distance: 0,
        duration: 0,
      }],
    };
    const [route] = vroomToRoutes(response, [makeVehicle(1)], [makeAddress(1), makeAddress(2)]);
    expect(route.stops[0].sequence).toBe(1);
    expect(route.stops[1].sequence).toBe(2);
  });

  it("arrival wraps via % 86400 — 86400 + 32400 still shows 9:00 AM", () => {
    const response: VroomResponse = {
      routes: [{
        vehicle: 1,
        vehicle_external_id: "1",
        steps: [jobStep("1", 86400 + 32400)],
        distance: 0,
        duration: 0,
      }],
    };
    const [route] = vroomToRoutes(response, [makeVehicle(1)], [makeAddress(1)]);
    expect(route.stops[0].timeWindow.time).toBe("9:00 AM");
  });
});
