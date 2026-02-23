import type { OptimizeRequest } from "@/lib/types/optimize.types"
import type { SessionSaveFile } from "@/lib/validation/session.schema"

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

// uses in-memory application state and puts it in a save format 
export function buildSessionSave( state: OptimizeRequest ): SessionSaveFile {
  const now = new Date()

  return {
    version: 1,
    savedAt: now.toISOString(),
    data: state,
  }
}

export function downloadSessionSave(
  state: OptimizeRequest
) {
  const saveFile = buildSessionSave(state)

  const filename =
    `routes_${filenameTimestamp(new Date(saveFile.savedAt))}.json`

  const jsonString = JSON.stringify(saveFile, null, 2)

  // Blob API creates a file object in browser memory
  const blob = new Blob([jsonString], {
    type: "application/json",
  })

  const objectUrl = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = objectUrl
  link.download = filename
  link.rel = "noopener"

  document.body.appendChild(link)
  link.click()

  // Clean up
  link.remove()
  URL.revokeObjectURL(objectUrl)
}