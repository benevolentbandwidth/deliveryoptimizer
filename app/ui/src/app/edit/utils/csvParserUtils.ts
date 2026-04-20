// Normalize the header to a consistent format
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s\-_.]+/g, "_");
}

/** Map a raw time-buffer string (seconds) to the nearest TIME_BUFFER_OPTIONS label. */
export function bufferSecondsToLabel(raw: string): string {
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
export function normalizeTimeOption(raw: string): string {
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

  
// Column aliases for the CSV file
const COLUMN_ALIASES: Record<string, string[]> = {
  address: ["address", "delivery_address", "street", "location", "destination"],
  time_window_start: [
    "time_window_start",
    "start_time",
    "delivery_start",
    "start",
    "time_start",
  ],
  time_window_end: [
    "time_window_end",
    "end_time",
    "delivery_end",
    "end",
    "time_end",
    "deliver_by",
  ],
  time_buffer: ["time_buffer", "buffer", "service_time"],
  demand_value: ["demand_value", "demand", "quantity", "qty", "packages"],
  notes: ["notes", "note", "comments", "instructions", "description"],
};

// Resolve the columns and return a tuple of the canonical column name and the alias
export function resolveColumns(
  headers: string[]
): Record<string, string | undefined> {
  const normalized = headers.map((h) => [h, normalizeHeader(h)] as const);
  const resolved: Record<string, string | undefined> = {};

  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    const match = normalized.find(([, norm]) => aliases.includes(norm));
    resolved[canonical] = match?.[0];
  }
  return resolved;
}
