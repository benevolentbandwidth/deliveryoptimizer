import { ZodError } from "zod";

import type { OptimizeRequest } from "@/lib/types/optimize.types";
import { migrateSessionSaveFile } from "@/lib/validation/session.schema";

const MAX_SESSION_FILE_BYTES = 1_000_000;

export async function loadSessionFromFile(file: File): Promise<OptimizeRequest> {
  const isJson =
    file.type === "application/json" || file.name.toLowerCase().endsWith(".json");

  if (!isJson) {
    throw new Error("Please select a valid .json save file.");
  }

  if (file.size > MAX_SESSION_FILE_BYTES) {
    throw new Error("File is too large to import.");
  }

  const text = await file.text();

  if (typeof text !== "string" || text.length === 0) {
    throw new Error("Invalid file contents.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }

  try {
    return migrateSessionSaveFile(parsed).data;
  } catch (e) {
    throw new Error(formatValidationError(e) ?? "Invalid save file format.");
  }
}

function formatValidationError(e: unknown): string | null {
  if (!(e instanceof ZodError)) return null;

  const issue = e.issues[0];
  if (!issue) return null;

  const path =
    Array.isArray(issue.path) && issue.path.length ? issue.path.join(".") : "file";

  return `Invalid save file format at "${path}".`;
}
