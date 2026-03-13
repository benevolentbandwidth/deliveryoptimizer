import type { OptimizeRequest } from "../types/optimize.types"
import { sessionSaveSchema, type SessionSaveFile } from "../validation/session.schema"

// session state return format
export type SessionExportResult =
  | { ok: true; filename: string }
  | { ok: false; error: Error }
  
// filename save format
function filenameTimestamp(date: Date) {
  const yyyy = String(date.getUTCFullYear())
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(date.getUTCDate()).padStart(2, "0")

  const hh = String(date.getUTCHours()).padStart(2, "0")
  const min = String(date.getUTCMinutes()).padStart(2, "0")
  const ss = String(date.getUTCSeconds()).padStart(2, "0")

  return `date_${yyyy}-${mm}-${dd}_time_${hh}-${min}-${ss}`
}

// uses in-memory state and puts it in a save format 
export function buildSessionSave(state: OptimizeRequest, now: Date = new Date()): SessionSaveFile {
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
    const saveFile = buildSessionSave(state, now)

    const filename = `routes_${filenameTimestamp(now)}.json`
    const jsonString = JSON.stringify(saveFile, null, 2)

    const blob = new Blob([jsonString], { type: "application/json" })
    const objectUrl = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = objectUrl
    link.download = filename

    document.body.appendChild(link)
    link.click()
    link.remove()

    setTimeout(() => URL.revokeObjectURL(objectUrl), 100)

    return { ok: true, filename }
  } catch (e) {
    const error = e instanceof Error ? e : new Error("export error")
    console.error("failed to export session save", error)
    return { ok: false, error }
  }
}
