import type { OptimizeRequest } from "../types/optimize.types"
import { parseSessionSaveFile } from "../validation/session.schema"
import { sanitizeOptimizeRequest } from "../validation/json-sanitization"

type LoadSessionCallbacks = {
  onSuccess: (state: OptimizeRequest) => void
  onError: (message: string) => void
  onLoadingChange?: (loading: boolean) => void
}

const MAX_SESSION_FILE_BYTES = 1_000_000

// Loads a saved session from a JSON file.
export function loadSessionFromFile(
  file: File,
  { onSuccess, onError, onLoadingChange }: LoadSessionCallbacks
) {
  const isJson =
    file.type === "application/json" || file.name.toLowerCase().endsWith(".json")

  if (!isJson) {
    onError("Please select a valid .json save file.")
    return
  }

  if (file.size > MAX_SESSION_FILE_BYTES) {
    onError("File is too large to import.")
    return
  }

  const reader = new FileReader()
  onLoadingChange?.(true)

  const finish = () => onLoadingChange?.(false)

  reader.onerror = () => {
    finish()
    onError("Failed to read file.")
  }

  reader.onload = () => {
    try {
      const text = reader.result
      if (typeof text !== "string") {
        onError("Invalid file contents.")
        return
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        onError("This file is not valid JSON.")
        return
      }

      let saveFile
      try {
        saveFile = parseSessionSaveFile(parsed)
      } catch (e) {
        onError(formatValidationError(e) ?? "Invalid save file format.")
        return
      }

      const cleanState = sanitizeOptimizeRequest(saveFile.data)
      onSuccess(cleanState)
    } finally {
      finish()
    }
  }

  reader.readAsText(file)
}

function formatValidationError(e: unknown): string | null {
  const anyErr = e as any
  const issue = anyErr?.issues?.[0]
  if (!issue) return null

  const path =
    Array.isArray(issue.path) && issue.path.length ? issue.path.join(".") : "file"

  return `Invalid save file format at "${path}".`
}