import { describe, expect, it } from "vitest";

import {
  parseRouteUploadFile,
  parseRouteUploadText,
} from "@/app/upload-route/routeUploadValidation";
import { buildSessionSave } from "@/lib/session/exportSession";

describe("driver route import", () => {
  it("loads a saved route-manager session into the driver_assist route shape", () => {
    const route = parseRouteUploadText(
      JSON.stringify(
        buildSessionSave(
          {
            deliveries: [
              {
                id: 42,
                recipientName: "Recipient 1",
                phoneNumber: "555-555-0100",
                address: "12 Compiler Way",
                notes: "Leave near side door",
                location: { lat: 37.1, lng: -122.2 },
                demand: { type: "units", value: 3 },
              },
            ],
            vehicles: [
              {
                id: 7,
                driverName: "driver1",
                vehicleType: "car",
                capacity: { type: "units", value: 10 },
              },
            ],
          },
          new Date("2026-05-16T12:00:00.000Z"),
        ),
      ),
    );

    expect(route).toEqual({
      driverName: "driver1",
      routeLabel: "Route 7 - 1 stops",
      stops: [
        {
          id: "42",
          stopNumber: 1,
          address: "12 Compiler Way",
          customerName: "Recipient 1",
          phoneNumber: "555-555-0100",
          packageCount: 3,
          notes: "Leave near side door",
          status: "pending",
          lat: 37.1,
          lng: -122.2,
          completedAt: undefined,
          failureReason: undefined,
        },
      ],
    });
  });

  it("loads the same saved session shape when vehicle start location is absent", () => {
    const route = parseRouteUploadText(
      JSON.stringify(
        buildSessionSave(
          {
            deliveries: [
              {
                id: 11,
                recipientName: "Recipient 3",
                address: "500 Save St",
                location: { lat: 34.1, lng: -118.2 },
                demand: { type: "units", value: 2 },
              },
            ],
            vehicles: [
              {
                id: 3,
                driverName: "driver3",
                vehicleType: "truck",
                capacity: { type: "units", value: 20 },
              },
            ],
          },
          new Date("2026-05-16T12:00:00.000Z"),
        ),
      ),
    );

    expect(route).toMatchObject({
      driverName: "driver3",
      routeLabel: "Route 3 - 1 stops",
      stops: [
        {
          id: "11",
          customerName: "Recipient 3",
          address: "500 Save St",
          packageCount: 2,
        },
      ],
    });
  });

  it("rejects invalid upload-route files before handing them to driver_assist", () => {
    expect(() => parseRouteUploadText(JSON.stringify({ version: 1 }))).toThrow(
      'Invalid save file format at "savedAt".',
    );
  });

  it("loads a Results page route export into the driver_assist route shape", () => {
    const route = parseRouteUploadText(
      JSON.stringify({
        vehicleId: "vehicle-7",
        driverName: "Driver Export",
        stops: [
          {
            id: "stop-later",
            address: "200 Second St",
            lat: 38.55,
            lng: -121.75,
            sequence: 2,
            capacityUsed: 4,
            timeWindow: { kind: "by", time: "13:00" },
            note: "Ring bell",
            addresseeName: "Second Customer",
            phoneNumber: "555-555-0202",
          },
          {
            id: "stop-first",
            address: "100 First St",
            lat: 38.54,
            lng: -121.74,
            sequence: 1,
            capacityUsed: 2,
            timeWindow: { kind: "from", time: "09:00" },
            note: "Leave at front desk",
            addresseeName: "First Customer",
            phoneNumber: "555-555-0101",
          },
        ],
      }),
    );

    expect(route).toEqual({
      driverName: "Driver Export",
      routeLabel: "Route vehicle-7 - 2 stops",
      stops: [
        {
          id: "stop-first",
          stopNumber: 1,
          address: "100 First St",
          customerName: "First Customer",
          phoneNumber: "555-555-0101",
          packageCount: 2,
          notes: "Leave at front desk",
          status: "pending",
          lat: 38.54,
          lng: -121.74,
          completedAt: undefined,
          failureReason: undefined,
        },
        {
          id: "stop-later",
          stopNumber: 2,
          address: "200 Second St",
          customerName: "Second Customer",
          phoneNumber: "555-555-0202",
          packageCount: 4,
          notes: "Ring bell",
          status: "pending",
          lat: 38.55,
          lng: -121.75,
          completedAt: undefined,
          failureReason: undefined,
        },
      ],
    });
  });

  it("preserves a zero-capacity stop from a Results page route export", () => {
    const route = parseRouteUploadText(
      JSON.stringify({
        vehicleId: "vehicle-7",
        stops: [
          {
            id: "zero-demand-stop",
            address: "100 First St",
            lat: 38.54,
            lng: -121.74,
            sequence: 1,
            capacityUsed: 0,
          },
        ],
      }),
    );

    expect(route.stops[0].packageCount).toBe(0);
  });

  it("loads a route CSV upload into the driver_assist route shape", () => {
    const route = parseRouteUploadFile(
      "driver-route.csv",
      [
        "sequence,address,addresseeName,phoneNumber,capacityUsed,note,lat,lng",
        '2,"200 Second St","Second Customer","555-555-0202",4,"Ring bell",38.55,-121.75',
        '1,"100 First St","First Customer","555-555-0101",2,"Leave at front desk",38.54,-121.74',
      ].join("\n"),
    );

    expect(route).toMatchObject({
      routeLabel: "CSV route - 2 stops",
      stops: [
        {
          stopNumber: 1,
          address: "100 First St",
          customerName: "First Customer",
          phoneNumber: "555-555-0101",
          packageCount: 2,
          notes: "Leave at front desk",
          lat: 38.54,
          lng: -121.74,
        },
        {
          stopNumber: 2,
          address: "200 Second St",
          customerName: "Second Customer",
          phoneNumber: "555-555-0202",
          packageCount: 4,
          notes: "Ring bell",
          lat: 38.55,
          lng: -121.75,
        },
      ],
    });
  });

  it("preserves a zero package count from a route CSV upload", () => {
    const route = parseRouteUploadFile(
      "zero-package-route.csv",
      [
        "sequence,address,capacityUsed,lat,lng",
        '1,"100 First St",0,38.54,-121.74',
      ].join("\n"),
    );

    expect(route.stops[0].packageCount).toBe(0);
  });

  it("rejects route CSV uploads with missing lat or lng values", () => {
    const missingLat = [
      "sequence,address,addresseeName,phoneNumber,capacityUsed,note,lat,lng",
      '1,"100 First St","First Customer","555-555-0101",2,"Leave at front desk",,-121.74',
    ].join("\n");
    const missingLng = [
      "sequence,address,addresseeName,phoneNumber,capacityUsed,note,lat,lng",
      '1,"100 First St","First Customer","555-555-0101",2,"Leave at front desk",38.54,',
    ].join("\n");

    expect(() => parseRouteUploadFile("missing-lat.csv", missingLat)).toThrow(
      "CSV route stops must include valid lat and lng columns.",
    );
    expect(() => parseRouteUploadFile("missing-lng.csv", missingLng)).toThrow(
      "CSV route stops must include valid lat and lng columns.",
    );
  });

  it("also accepts a direct optimize request JSON file", () => {
    const route = parseRouteUploadText(
      JSON.stringify({
        deliveries: [
          {
            id: 9,
            recipientName: "Recipient 2",
            address: "620 G St, Davis, CA 95616",
            location: { lat: 38.5464, lng: -121.7446 },
            demand: { type: "units", value: 1 },
          },
        ],
        vehicles: [
          {
            id: 2,
            driverName: "driver2",
            vehicleType: "car",
            capacity: { type: "units", value: 10 },
          },
        ],
      }),
    );

    expect(route).toMatchObject({
      driverName: "driver2",
      stops: [
        {
          customerName: "Recipient 2",
          address: "620 G St, Davis, CA 95616",
        },
      ],
    });
  });
});
