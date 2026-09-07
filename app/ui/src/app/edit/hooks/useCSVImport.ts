// app/edit/hooks/useCSVImport.ts
/**
 * Handles file parsing (CSV and raw JSON arrays) and controls visibility
 * of the CSVImportModal.
 *
 * Both file types are normalised to string[][] so the modal's column-mapper
 * and row-selector work identically regardless of source format:
 *
 *   .json (raw array)  — parseJsonToRows: keys → headers, values → rows.
 *                        Session saves (vehicles+deliveries) are rejected here;
 *                        they go through loadSessionFromFile in edit/page.tsx.
 *   .csv               — parseCsvToRows: RFC-4180 tokeniser.
 *
 * Bug #1 fix (PR review): raw JSON arrays are handled by the .json branch
 * via parseJsonToRows — they do NOT fall through to the CSV tokeniser, which
 * would produce garbage. The branch is selected by file extension before
 * reading begins.
 *
 * Exposes isLoading so upload pages can show a spinner while the file is
 * being read and parsed before the modal opens.
 */

import { useState, useCallback } from "react";

export function useCSVImport() {
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const openImportModal = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setParseError("Your file exceeds 10 MB. Please use a smaller file.");
      return;
    }

    setParseError(null);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const name = file.name.toLowerCase();

        let rows: string[][];

        // Extension-based dispatch: JSON arrays go through parseJsonToRows,
        // CSVs go through parseCsvToRows. This ensures JSON syntax is never
        // fed to the RFC-4180 tokeniser (which would produce garbage rows).
        if (name.endsWith(".json")) {
          rows = parseJsonToRows(text);
        } else {
          rows = parseCsvToRows(text);
        }

        if (rows.length < 2) {
          setParseError(
            "File must have a header row and at least one data row.",
          );
          return;
        }

        setCsvData(rows);
        setIsImportModalOpen(true);
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : "Failed to parse file.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setParseError("Failed to read file.");
      setIsLoading(false);
    };
    reader.readAsText(file);
  }, []);

  const closeImportModal = useCallback(() => {
    setIsImportModalOpen(false);
    setCsvData([]);
    setParseError(null);
  }, []);

  return {
    csvData,
    isImportModalOpen,
    isLoading,
    parseError,
    openImportModal,
    closeImportModal,
  };
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

/**
 * Converts a JSON array of objects into string[][].
 * The union of all keys across all objects becomes the header row.
 * Throws if the content is a session save (has vehicles + deliveries keys).
 */
function parseJsonToRows(text: string): string[][] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }

  // Reject session save files — they have a different import path
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    "vehicles" in (parsed as object) &&
    "deliveries" in (parsed as object)
  ) {
    throw new Error(
      "This looks like a session save file. Use the session restore flow instead.",
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("JSON file must contain a non-empty array of objects.");
  }

  const objects = parsed as Record<string, unknown>[];

  // Collect all keys across all objects to build a stable header row
  const headerSet = new Set<string>();
  for (const obj of objects) {
    if (obj && typeof obj === "object") {
      Object.keys(obj).forEach((k) => headerSet.add(k));
    }
  }

  const headers = Array.from(headerSet);
  if (headers.length === 0) {
    throw new Error("JSON objects have no keys to map.");
  }

  const dataRows = objects.map((obj) =>
    headers.map((h) => {
      const val = obj?.[h];
      return val == null ? "" : String(val);
    }),
  );

  return [headers, ...dataRows];
}

/**
 * Minimal RFC-4180 CSV parser — handles quoted fields, embedded commas,
 * CRLF and LF line endings.
 */
export function parseCsvToRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (ch === "\r" && next === "\n") {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
        i++;
      } else if (ch === "\n" || ch === "\r") {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell !== ""));
}
