import type { VroomResponse, VroomRoute, VroomStep } from "../types/vroomResponse";
import type { VehicleRow, AddressCard } from "../types/delivery";
import type { Route, Stop } from "@/app/results/types";

const METERS_TO_MILES = 0.000621371;

/** Converts seconds-from-midnight to a "H:MM AM/PM" string (e.g. 32400 → "9:00 AM"). */
export function secondsToTimeString(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 || 12;
  const mm = String(minutes).padStart(2, "0");
  return `${hours12}:${mm} ${period}`;
}

/**
 * Transforms a raw VROOM API response into the Route[] shape used by the results page.
 * Joins VROOM route/step data with original form state to populate address strings,
 * vehicle names, and driver information.
 */
export function vroomToRoutes(
  vroomResponse: VroomResponse,
  vehicles: VehicleRow[],
  addresses: AddressCard[]
): Route[] {
  const vehicleById = new Map(vehicles.map((v) => [String(v.id), v]));
  const addressById = new Map(addresses.map((a) => [String(a.id), a]));

  return vroomResponse.routes.map((vroomRoute: VroomRoute): Route => {
    const vehicle = vehicleById.get(vroomRoute.vehicle_external_id);

    const jobSteps = vroomRoute.steps.filter(
      (s: VroomStep) => s.type === "job" && s.job_external_id != null
    );

    const stops: Stop[] = jobSteps.map((step: VroomStep, idx: number): Stop => {
      const address = addressById.get(step.job_external_id!);
      const lng = step.location[0];
      const lat = step.location[1];

      // arrival is in seconds; % 86400 extracts the within-day portion for display
      const arrivalTimeStr = secondsToTimeString(step.arrival % 86400);

      return {
        id: step.job_external_id!,
        address: address?.recipientAddress ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
        sequence: idx + 1,
        capacityUsed: step.load?.[0] ?? 0,
        timeWindow: {
          kind: (() => {
            const start = address?.deliveryTimeStart;
            const end = address?.deliveryTimeEnd;
            if (start && end) return "at";
            if (end) return "by";
            if (start) return "from";
            return "by";
          })(),
          time: arrivalTimeStr,
        },
        note: address?.notes ?? "",
        addresseeName: undefined,
      };
    });

    return {
      vehicleId: vroomRoute.vehicle_external_id,
      driverName: vehicle?.name || `Vehicle ${vroomRoute.vehicle_external_id}`,
      stops,
      vehicleType: vehicle?.type || undefined,
      distanceMi: Math.round(vroomRoute.distance * METERS_TO_MILES * 10) / 10,
      estimatedTimeMinutes: Math.round(vroomRoute.duration / 60),
    };
  });
}
