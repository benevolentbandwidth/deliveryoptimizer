/**
 * CSV upload hook: parses a CSV file into AddressCard[],
 * then bulk-imports them into the edit page state.
 */

import { useCallback, useState } from "react";
import Papa from "papaparse";
import type { AddressCard } from "../types/delivery";
import { resolveColumns } from "@/app/edit/utils/csvParserUtils";
import { hasAtLeastOneLetter } from "@/app/components/AddressGeocoder/utils";

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
};

export function useCSVUpload({ importAddresses }: UseCSVUploadArgs) {
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
            const cols = resolveColumns(results.meta.fields ?? []);
            if (!cols.address) {
              setCsvError(
                'CSV must contain an "address" column (or similar: "delivery address", "street", "location", "destination").',
              );
              return;
            }
            
            // Getter lambda to get the value of a column from the row
            const get = (row: Record<string, string>, key: string) =>
              (cols[key] ? row[cols[key]!]?.trim() : undefined) ?? "";

            const addresses: AddressCard[] = [];
            let addrId = 1;

            for (const row of results.data) {
              const address = get(row, "address");
              if (!address || !hasAtLeastOneLetter(address)) continue;

              const timeStart = normaliseTimeOption(
                get(row, "time_window_start"),
              );
              const timeEnd = normaliseTimeOption(get(row, "time_window_end"));

              addresses.push({
                id: addrId++,
                locked: true,
                editingExisting: false,
                recipientAddress: address,
                timeBuffer: bufferSecondsToLabel(get(row, "time_buffer")),
                deliveryTimeStart: timeStart,
                deliveryTimeEnd: timeEnd,
                deliveryQuantity:
                  parseInt(get(row, "demand_value") || "1", 10) || 1,
                notes: get(row, "notes"),
              });
            }

            if (addresses.length === 0) {
              setCsvError("No valid deliveries found in the CSV.");
              return;
            }

            importAddresses(addresses);
          } catch {
            setCsvError("Error parsing CSV file.");
          }
        },
        error: (err) => {
          setCsvError(`CSV parsing error: ${err.message}`);
        },
      });
    },
    [importAddresses],
  );

  const clearCsvError = useCallback(() => setCsvError(null), []);

  return { handleCSVUpload, csvFileName, csvError, clearCsvError };
}
