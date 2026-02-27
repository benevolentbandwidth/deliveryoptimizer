import type { OptimizeRequest } from "../types/optimize.types"
import { sessionSaveSchema, type SessionSaveFile } from "../validation/session.schema"

// session state return format
export type SessionExportResult =
  | { ok: true; filename: string }
  | { ok: false; error: Error }
  
// filename save format
function filenameTimestamp(date: Date) {
  const yyyy = String(date.getFullYear())
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")

  const hh = String(date.getHours()).padStart(2, "0")
  const min = String(date.getMinutes()).padStart(2, "0")
  const ss = String(date.getSeconds()).padStart(2, "0")

  return `date_${yyyy}-${mm}-${dd}_time_${hh}-${min}-${ss}`
}

// uses in-memory state and puts it in a save format 
export function buildSessionSave(state: OptimizeRequest): SessionSaveFile {
  const now = new Date()

  const saveFile = {
    version: 1,
    savedAt: now.toISOString(),
    data: state,
  } as const

  // runtime validation to catch schema change/ invalid state
  return sessionSaveSchema.parse(saveFile)
}


export function downloadSessionSave(state: OptimizeRequest): SessionExportResult {
  try {
    const now = new Date()
    const saveFile = sessionSaveSchema.parse({
      version: 1,
      savedAt: now.toISOString(),
      data: state,
    })

    const filename = `routes_${filenameTimestamp(now)}.json`
    const jsonString = JSON.stringify(saveFile, null, 2)

    const blob = new Blob([jsonString], { type: "application/json" })
    const objectUrl = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = objectUrl
    link.download = filename
    link.rel = "noopener"

    document.body.appendChild(link)
    link.click()

    link.remove()
    URL.revokeObjectURL(objectUrl)

    return { ok: true, filename }
  } catch (e) {
    const error = e instanceof Error ? e : new Error("export error")
    console.error("failed to export session save", error)
    return { ok: false, error }
  }
}