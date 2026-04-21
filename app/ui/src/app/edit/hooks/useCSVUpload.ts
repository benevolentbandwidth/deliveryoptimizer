/**
 * CSV upload hook: parses a CSV file into AddressCard[],
 * then bulk-imports them into the edit page state.
 */

import { useCallback, useState } from "react";
import Papa from "papaparse";
import type { AddressCard } from "../types/delivery";
import { resolveColumns, normalizeTimeOption, bufferSecondsToLabel } from "@/app/edit/utils/csvParserUtils";
import { hasAtLeastOneLetter } from "@/app/components/AddressGeocoder/utils";

type UseCSVUploadArgs = {
  importAddresses: (addresses: AddressCard[]) => void;
};

export function useCSVUpload({ importAddresses }: UseCSVUploadArgs) {
  const [csvError, setCsvError] = useState<string | null>(null);

  const handleCSVUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

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

              const timeStart = normalizeTimeOption(
                get(row, "time_window_start"),
              );
              const timeEnd = normalizeTimeOption(get(row, "time_window_end"));

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
          } catch (err) {
            setCsvError(
              err instanceof Error
                ? `Failed to process CSV: ${err.message}`
                : "An unexpected error occurred while processing the CSV."
            );
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

  return { handleCSVUpload, csvError, clearCsvError };
}
