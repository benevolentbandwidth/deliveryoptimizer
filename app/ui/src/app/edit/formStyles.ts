/**
 * Shared Tailwind class tokens for the delivery edit form. Prefer complete string literals so
 * Tailwind's scanner includes all utilities. Vehicle editing panel constants compose
 * `EDITING_EXISTING_HIGHLIGHT` at module load (still scanned in this file).
 */

export const NAVBAR_HEADER =
  "flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-4 sm:px-6 md:px-8 py-4 border-b border-zinc-200";

export const NAVBAR_LOGO_PLACEHOLDER = "bg-zinc-300 px-4 py-2 text-sm font-sans-manrope w-fit";

export const NAVBAR_ACTIONS_WRAP = "flex flex-wrap items-center gap-2 md:justify-end";

export const NAVBAR_ICON_BUTTON =
  "w-11 h-11 bg-zinc-300 rounded-full flex items-center justify-center cursor-pointer hover:bg-zinc-400 transition-colors";

export const NAVBAR_OUTLINE_PILL =
  "h-11 px-6 rounded-full border border-zinc-300 bg-white text-black text-base font-normal hover:bg-zinc-400/30 transition-colors cursor-pointer";

export const NAVBAR_SOLID_PILL =
  "h-11 px-6 rounded-full bg-zinc-300 text-black text-base font-normal hover:bg-zinc-400 transition-colors cursor-pointer";

/** Invalid vs valid focus/border desktop inputs (Address desktop + all Vehicle fields). */
export function fieldBorder(invalid: boolean, mode: "desktop" | "mobile" = "desktop"): string {
  if (mode === "mobile") {
    if (invalid) {
      return "border-red-500 focus:border-red-500";
    }
    return "border-zinc-300 focus:border-zinc-400";
  }
  if (invalid) {
    return "border-red-500 focus:border-red-500";
  }
  return "border-zinc-300 focus:border-zinc-500";
}
/** Editing an existing unlocked row, same ring, border, and fill on address + vehicle surfaces. */
export const EDITING_EXISTING_HIGHLIGHT =
  "border border-blue-200 bg-blue-50 ring-2 ring-blue-200";

/** Composed at module load from EDITING_EXISTING_HIGHLIGHT (Tailwind still scans the template). */
export const VEHICLE_DESKTOP_EDITING_PANEL =
  `col-span-full rounded-lg p-2 ${EDITING_EXISTING_HIGHLIGHT}`;

/** Composed at module load from EDITING_EXISTING_HIGHLIGHT (Tailwind still scans the template). */
export const VEHICLE_MOBILE_EDITING_CARD =
  `rounded-xl p-4 space-y-3 ${EDITING_EXISTING_HIGHLIGHT}`;

export const MOBILE_FIELD_LABEL = "text-sm text-black block mb-1";

export const ICON_BUTTON_9 =
  "w-9 h-9 rounded-md border border-zinc-300 flex items-center justify-center text-black hover:bg-zinc-100 transition-colors cursor-pointer";

export const ICON_BUTTON_9_DANGER =
  "w-9 h-9 rounded-md border border-zinc-300 flex items-center justify-center text-black hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer disabled:opacity-0 disabled:pointer-events-none";

/** Name/type/measure/departure flex; capacity + Available (No/Yes pill) stay fixed width below xl. */
export const DESKTOP_VEHICLE_GRID_CLASS =
  "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_72px_108px_minmax(0,1fr)_auto] xl:grid-cols-[1fr_1.5fr_1fr_1fr_112px_112px_140px_auto]";

export const VEHICLE_DESKTOP_INPUT =
  "h-11 bg-white rounded-md border px-3 xl:px-4 text-sm xl:text-base text-black focus:outline-none min-w-0";

export const VEHICLE_DESKTOP_WIDE_INPUT =
  "h-11 w-full bg-white rounded-md border px-3 xl:px-4 text-sm xl:text-base text-black focus:outline-none min-w-0";

export const VEHICLE_DESKTOP_SELECT =
  "h-11 w-full bg-white rounded-md border px-3 xl:px-4 text-sm xl:text-base text-black focus:outline-none cursor-pointer select-chevron capitalize min-w-0";

export const VEHICLE_DESKTOP_NUMBER_INPUT =
  "h-11 w-full min-w-0 bg-white rounded-md border px-3 xl:px-4 text-sm xl:text-base text-black focus:outline-none";

export const VEHICLE_DESKTOP_DEPARTURE_SELECT =
  "h-11 w-full bg-white rounded-md border px-3 xl:px-4 text-sm xl:text-base text-black focus:outline-none cursor-pointer select-chevron min-w-0";

export const VEHICLE_MOBILE_INPUT =
  "h-11 w-full rounded-md border px-4 text-base text-black focus:outline-none min-w-0";

export const VEHICLE_MOBILE_SELECT =
  "h-11 w-full rounded-md border px-4 text-base text-black focus:outline-none cursor-pointer capitalize min-w-0 select-chevron";

/** Segmented No / Yes for vehicle Available: sliding rounded thumb + transparent labels (desktop + mobile). */
export const VEHICLE_AVAILABLE_SEGMENTED_TRACK =
  "relative inline-flex w-full min-w-0 max-w-full shrink-0 rounded-full border border-zinc-300 bg-white p-0.5 overflow-hidden";

export const VEHICLE_AVAILABLE_SEGMENT_THUMB =
  "absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-full border border-zinc-300 bg-zinc-200 shadow-sm pointer-events-none transition-transform duration-200 ease-out motion-reduce:transition-none";

export const VEHICLE_AVAILABLE_SEGMENT_THUMB_NO = "translate-x-0";

export const VEHICLE_AVAILABLE_SEGMENT_THUMB_YES = "translate-x-full";

export const VEHICLE_AVAILABLE_SEGMENT_ROW = "relative z-10 flex w-full";

export const VEHICLE_AVAILABLE_SEGMENT_BUTTON =
  "relative z-10 flex-1 min-w-0 text-center text-xs font-medium text-black py-1.5 bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1 cursor-pointer";

export const VEHICLE_AVAILABLE_SEGMENT_READ_ONLY_SPAN =
  "relative z-10 flex-1 min-w-0 text-center text-xs font-medium text-black py-1.5 bg-transparent";

/** Locked summary cells w-full fills fixed-width grid columns and is harmless in fr columns. */
export const VEHICLE_LOCKED_CELL =
  "h-11 w-full bg-zinc-300 rounded-md flex items-center px-3 xl:px-4";

export const VEHICLE_CONFIRM_DESKTOP =
  "h-9 px-3 rounded-md border border-blue-300 bg-blue-100 text-blue-800 text-sm font-medium hover:bg-blue-200 transition-colors cursor-pointer";

export const VEHICLE_MOBILE_CARD = "rounded-xl border border-zinc-200 p-4 space-y-3";

export const VEHICLE_PILL_FULL_DANGER =
  "w-full h-11 rounded-full border border-zinc-300 text-black text-base font-normal hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer disabled:opacity-0 disabled:pointer-events-none";

export const VEHICLE_PILL_FULL_PRIMARY =
  "w-full h-11 rounded-full border border-blue-300 bg-blue-100 text-blue-800 text-base font-medium hover:bg-blue-200 transition-colors cursor-pointer";

export const VEHICLE_PILL_HALF =
  "flex-1 h-11 rounded-full border border-zinc-300 text-black text-base font-normal hover:bg-zinc-50 transition-colors cursor-pointer";

export const VEHICLE_PILL_HALF_DANGER =
  "flex-1 h-11 rounded-full border border-zinc-300 text-black text-base font-normal hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer disabled:opacity-0 disabled:pointer-events-none";

export const VEHICLE_SECTION_TITLE = "text-base font-semibold text-black mb-4";

export const VEHICLE_HEADER_CELL_START =
  "text-xs lg:text-sm xl:text-base text-black justify-self-start";

export const VEHICLE_HEADER_CELL_CENTER =
  "text-xs lg:text-sm xl:text-base text-black justify-self-center";

export const VEHICLE_GRID_WRAP = "hidden lg:grid gap-x-3 xl:gap-x-4 gap-y-3 items-center";

export const VEHICLE_GRID_INNER = "gap-x-3 xl:gap-x-4 items-center";

export const VEHICLE_ADD_ENABLED =
  "w-full md:w-auto h-11 px-6 rounded-full border text-base font-normal transition-colors border-zinc-300 text-black hover:bg-zinc-50 cursor-pointer";

export const VEHICLE_ADD_DISABLED =
  "w-full md:w-auto h-11 px-6 rounded-full border text-base font-normal transition-colors border-zinc-200 text-zinc-400 cursor-not-allowed";

/** Fixed wrapper width for the AvailableSegmented control (desktop + mobile). */
export const VEHICLE_AVAILABLE_SEGMENT_WRAPPER = "w-[7.5rem] shrink-0";

/** Text span inside a mobile locked field cell. */
export const VEHICLE_MOBILE_LOCKED_TEXT = "text-base text-black truncate";

/** Text span inside a desktop locked field cell. */
export const VEHICLE_DESKTOP_LOCKED_TEXT = "text-sm xl:text-base text-black truncate";

/** Wrapper div for the AvailableSegmented control in the desktop grid (locked + editing). */
export const VEHICLE_DESKTOP_AVAILABLE_CELL = "flex items-center justify-center h-11 min-w-0 px-0.5";

/** Action button container in the desktop grid (locked + editing). */
export const VEHICLE_DESKTOP_ACTION_CELL = "flex items-center gap-1";

/** Row wrapping the Available label and segmented control in mobile cards. */
export const VEHICLE_MOBILE_AVAILABLE_ROW = "flex items-center justify-between gap-3 pt-1";

/** "Available" label text in mobile cards. */
export const VEHICLE_MOBILE_AVAILABLE_LABEL = "text-sm text-black";

/** Button row at the bottom of a mobile locked card (Edit + Delete). */
export const VEHICLE_MOBILE_LOCKED_ACTIONS = "flex gap-2 pt-2";

/** Confirm + Delete column at the bottom of a mobile editing-existing card. */
export const VEHICLE_MOBILE_EDITING_ACTIONS = "flex flex-col gap-2 pt-2";
