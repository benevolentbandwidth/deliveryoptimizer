import type { OptimizeRequest } from "@/lib/types/optimize.types"
import { sessionSaveSchema } from "@/lib/validation/session.schema"

type LoadSessionCallbacks = {
  onSuccess: (state: OptimizeRequest) => void
  onError: (message: string) => void
}

//Loads session using JSON file
export function loadSessionFromFile( file: File, { onSuccess, onError }: LoadSessionCallbacks) {
  const isJson =
    file.type === "application/json" ||
    file.name.toLowerCase().endsWith(".json")

  if (!isJson) {
    onError("Please select a valid .json save file.")
    return
  }

  const reader = new FileReader()

  reader.onerror = () => {
    onError("Failed to read file.")
  }

  reader.onload = () => {
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

    const validation = sessionSaveSchema.safeParse(parsed)
    if (!validation.success) {
      onError("Invalid save file format.")
      return
    }

    onSuccess(validation.data.data)
  }

  reader.readAsText(file)
}