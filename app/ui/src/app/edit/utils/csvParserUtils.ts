// Normalize the header to a consistent format
function normalizeHeader(h: string): string {
    return h.toLowerCase().replace(/[\s\-_.]+/g, "_").trim();
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
  