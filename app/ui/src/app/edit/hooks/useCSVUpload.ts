/**
 * CSV upload hook: parses a CSV file into AddressCard[] and VehicleRow[],
 * then bulk-imports them into the edit page state.
 */

import { useCallback, useState } from "react";
import Papa from "papaparse";
import type { AddressCard, CapacityUnit, VehicleRow, VehicleType } from "../types/delivery";
import { hasAtLeastOneLetter } from "@/app/components/AddressGeocoder/utils";

const VALID_VEHICLE_TYPES: VehicleType[] = ["truck", "car", "bicycle"];

/** Map a raw time-buffer string (seconds) to the nearest TIME_BUFFER_OPTIONS label. */
function bufferSecondsToLabel(raw: string): string {
  const secs = parseInt(raw, 10);
  if (isNaN(secs) || secs <= 0) return "";
  const mins = Math.round(secs / 60);
  if (mins <= 5) return "5 min";
  if (mins <= 10) return "10 min";
  if (mins <= 30) return "30 min";
  if (mins <= 45) return "45 min";
  const hrs = Math.round(mins / 60);
  if (hrs <= 1) return "1hr";
  if (hrs <= 2) return "2hr";
  if (hrs <= 3) return "3hr";
  if (hrs <= 4) return "4hr";
  if (hrs <= 5) return "5hr";
  if (hrs <= 6) return "6hr";
  if (hrs <= 7) return "7hr";
  return "8hr";
}

/**
 * Convert a raw time value (seconds-from-midnight or "H:MM AM/PM") into a
 * TIME_OPTIONS-compatible "H:MM AM/PM" string, snapped to the nearest 15 min.
 */
function normaliseTimeOption(raw: string): string {
  if (!raw || raw.trim() === "") return "";
  const trimmed = raw.trim();

  let totalMinutes: number;
  if (/^\d+$/.test(trimmed)) {
    totalMinutes = Math.round(parseInt(trimmed, 10) / 60);
  } else {
    const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const isPM = match[3].toUpperCase() === "PM";
      if (h === 12) h = isPM ? 12 : 0;
      else if (isPM) h += 12;
      totalMinutes = h * 60 + m;
    } else {
      return "";
    }
  }

  const snapped = Math.round(totalMinutes / 15) * 15;
  const h24 = Math.floor(snapped / 60) % 24;
  const m = snapped % 60;
  const hour12 = h24 % 12 || 12;
  const period = h24 < 12 ? "AM" : "PM";
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

type UseCSVUploadArgs = {
  importAddresses: (addresses: AddressCard[]) => void;
  importVehicles: (vehicles: VehicleRow[]) => void;
};

export function useCSVUpload({ importAddresses, importVehicles }: UseCSVUploadArgs) {
  const [csvFileName, setCsvFileName] = useState("");
  const [csvError, setCsvError] = useState<string | null>(null);

  const handleCSVUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setCsvFileName(file.name);
      setCsvError(null);

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8",
        complete: (results) => {
          try {
            const addresses: AddressCard[] = [];
            const vehicles: VehicleRow[] = [];
            let addrId = 1;
            let vehId = 1;

            for (const row of results.data) {
              const rowType = row.type?.toLowerCase();

              if (rowType === "delivery") {
                const address = row.address?.trim() ?? "";
                if (!address || !hasAtLeastOneLetter(address)) continue;

                const timeStart = normaliseTimeOption(row.time_window_start ?? "")
                const timeEnd = normaliseTimeOption(row.time_window_end ?? "")
                const hasBothWindows = timeStart !== "" && timeEnd !== "";

                addresses.push({
                  id: addrId++,
                  locked: true,
                  editingExisting: false,
                  recipientAddress: address,
                  timeBuffer: bufferSecondsToLabel(row.time_buffer ?? ""),
                  deliveryTimeMode: hasBothWindows ? "between" : "by",
                  deliveryBy: hasBothWindows ? "" : timeEnd || timeStart,
                  deliveryBetween: hasBothWindows ? `${timeStart} - ${timeEnd}` : "", // TODO: Add validation for delivery between
                  deliveryQuantity: parseInt(row.demand_value ?? "1", 10) || 1,
                  notes: row.notes?.trim() ?? "",
                });
              } else if (rowType === "vehicle") {
                const startAddr = row.start_address?.trim() ?? "";
                if (!hasAtLeastOneLetter(startAddr)) continue;

                const rawVehicleType = (row.vehicle_type ?? "").toLowerCase();
                const vehicleType: VehicleType | "" = VALID_VEHICLE_TYPES.includes(rawVehicleType as VehicleType)
                  ? (rawVehicleType as VehicleType)
                  : VALID_VEHICLE_TYPES[1] as VehicleType;  // Default to car if no valid type is provided

                vehicles.push({
                  id: vehId++,
                  locked: true,
                  editingExisting: false,
                  name: row.name?.trim() ?? `Vehicle ${vehId - 1}`,
                  startLocation: startAddr,
                  type: vehicleType,
                  capacityUnit: (row.capacity_unit as CapacityUnit) ?? "units" as CapacityUnit,
                  capacity: parseInt(row.capacity ?? "100", 10) || 100,
                  available: true,
                  departureTime: normaliseTimeOption(row.departure_time ?? "") || "8:00 AM",
                });
              }
            }

            if (addresses.length === 0 && vehicles.length === 0) {
              setCsvError("No valid deliveries or vehicles found in the CSV.");
              return;
            }

            if (addresses.length > 0) importAddresses(addresses);
            if (vehicles.length > 0) importVehicles(vehicles);
          } catch {
            setCsvError("Error parsing CSV file.");
          }
        },
        error: (err) => {
          setCsvError(`CSV parsing error: ${err.message}`);
        },
      });

      // Reset so re-uploading the same file still triggers onChange.
      event.target.value = "";
    },
    [importAddresses, importVehicles],
  );

  const clearCsvError = useCallback(() => setCsvError(null), []);

  return { handleCSVUpload, csvFileName, csvError, clearCsvError };
}
