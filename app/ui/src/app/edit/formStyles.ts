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

/** Applied to a locked summary cell when its address/location failed geocoding. */
export const GEOCODE_ERROR_LOCKED = "border border-red-500";

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
  "h-11 w-full bg-zinc-300 rounded-md flex items-center px-3 xl:px-4 overflow-hidden";

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

/** Address desktop: two tiers (md / xl) so dropdown columns keep room without triple minmax ladders. */
export const DESKTOP_ADDRESS_GRID_CLASS =
  "lg:grid-cols-[2.95fr_minmax(6rem,0.52fr)_minmax(10.5rem,0.78fr)_minmax(3.25rem,0.48fr)_2.35fr_auto] xl:grid-cols-[3fr_minmax(6rem,0.55fr)_minmax(16rem,0.85fr)_minmax(3.25rem,0.55fr)_2.45fr_auto]";

export const ADDRESS_DESKTOP_GRID_GAP =
  "gap-x-2.5 lg:gap-x-3 xl:gap-x-4 gap-y-1 lg:gap-y-1.5 xl:gap-y-2";

export const ADDRESS_DESKTOP_HDR =
  "text-xs font-medium text-black justify-self-start leading-none lg:text-sm xl:text-base";

export const ADDRESS_DESKTOP_FIELD = "text-xs text-black lg:text-sm";

export const ADDRESS_DESKTOP_CONTROL_H = "h-8 min-h-[2rem] xl:h-9";

export const ADDRESS_DESKTOP_PAD = "px-2 xl:px-3";

/** Tight chevron padding for address desktop selects (globals: select-chevron-tight). */
export const ADDRESS_DESKTOP_SELECT_BASE =
  "w-full min-w-0 rounded-lg border h-8 min-h-[2rem] xl:h-9 text-xs text-black lg:text-sm focus:outline-none cursor-pointer select-chevron-tight pl-2 pr-10 xl:pl-3 xl:pr-10";

export const ADDRESS_DESKTOP_MODE_SELECT =
  "w-full min-w-0 rounded-lg border border-zinc-200 bg-white h-8 min-h-[2rem] xl:h-9 px-2 xl:px-3 text-xs text-black lg:text-sm font-medium focus:outline-none cursor-pointer select-chevron-tight pl-2 pr-10 xl:pl-3 xl:pr-10";

export const MOBILE_ADDRESS_INPUT_BASE =
  "h-9 w-full rounded-lg px-3 text-sm text-black focus:outline-none border border-zinc-200 bg-white";

/** Delivery by/between mode select on mobile (no validation). */
export const MOBILE_ADDRESS_SELECT_MODE =
  "h-9 w-full rounded-lg px-3 text-sm font-medium text-black focus:outline-none border border-zinc-200 bg-white cursor-pointer select-chevron";

/** Floor widths so time-buffer / delivery / qty columns resist clipping at md/xl. */
export const ADDRESS_COL_MIN_TIME_BUFFER = "min-w-[6rem]";
export const ADDRESS_COL_MIN_QTY = "min-w-[3.25rem]";

export const ADDRESS_DELIVERY_COLUMN =
  "flex h-full min-h-[4.25rem] w-full min-w-0 flex-col gap-1 self-stretch xl:min-h-[4.75rem] min-w-[10.5rem]";

export const ADDRESS_NOTES_COLUMN =
  "flex h-full min-h-[4.25rem] flex-col self-stretch xl:min-h-[4.75rem]";

/** Outer card: bordered panel on small screens; padding + flush join on md+ (panel border from list). */
export const ADDRESS_CARD_ROOT_BASE =
  "rounded-xl border border-zinc-300 overflow-hidden bg-white lg:rounded-none lg:border-0 lg:overflow-visible lg:bg-transparent lg:px-3 lg:py-4 xl:p-5";

export const ADDRESS_CARD_EDITING_EXTRA = "lg:rounded-lg";

export const ADDRESS_LOCKED_SURFACE_MD = "h-8 min-h-[2rem] xl:h-9 self-start bg-zinc-300 rounded-lg flex items-center px-2 xl:px-3 overflow-hidden";

export const ADDRESS_NOTES_LOCKED_BOX =
  "min-h-0 flex-1 overflow-hidden rounded-lg bg-zinc-300 px-2 py-1.5 xl:px-3 xl:py-2";

export const ADDRESS_TEXTAREA_EDIT =
  "min-h-0 w-full min-w-0 flex-1 rounded-lg border border-zinc-300 px-2 xl:px-3 py-2 xl:py-2.5 text-xs text-black lg:text-sm focus:outline-none focus:border-zinc-500 resize-none leading-snug xl:leading-6 bg-white";

export const ADDRESS_INPUT_DESKTOP_BASE =
  "w-full min-w-0 self-start rounded-lg border h-8 min-h-[2rem] xl:h-9 px-2 xl:px-3 text-xs text-black lg:text-sm focus:outline-none bg-white";

export const MOBILE_ADDRESS_LOCKED_ROW = "h-9 bg-zinc-300 rounded-lg flex items-center px-3 overflow-hidden";

export const MOBILE_ADDRESS_NOTES_AREA = "min-h-[6rem] bg-zinc-300 rounded-lg flex items-start px-3 py-2 overflow-hidden";

export const MOBILE_ADDRESS_NOTES_TEXTAREA =
  "w-full min-h-[6.5rem] rounded-lg px-3 py-2 text-sm text-black focus:outline-none border border-zinc-300 bg-white focus:border-zinc-400 resize-none leading-6";

export const PILL_ROW_HALF_NEUTRAL = "flex-1 h-10 rounded-full border border-zinc-300 text-black text-sm font-medium hover:bg-zinc-50 cursor-pointer";

export const PILL_ROW_HALF_DANGER =
  "flex-1 h-10 rounded-full border border-zinc-300 text-black text-sm font-medium hover:bg-red-50 hover:text-red-600 cursor-pointer disabled:opacity-0 disabled:pointer-events-none";

export const CONFIRM_PILL_MOBILE =
  "w-full h-10 rounded-full border border-blue-300 bg-blue-100 text-blue-800 text-sm font-medium hover:bg-blue-200 cursor-pointer";

export const CONFIRM_BUTTON_DESKTOP =
  "h-8 px-2.5 rounded-md border border-blue-300 bg-blue-100 text-blue-800 text-xs font-medium hover:bg-blue-200 transition-colors cursor-pointer xl:h-9 xl:px-3 xl:text-sm";

export const MOBILE_DELETE_TEXT =
  "w-full text-center text-sm text-black py-2 hover:text-red-600 cursor-pointer disabled:opacity-0 disabled:pointer-events-none";

export const ACCORDION_TRIGGER =
  "w-full flex items-start gap-3 p-4 text-left border-b border-zinc-200";

export const ADDRESS_SECTION_TITLE = "text-sm font-semibold text-black mb-3 xl:text-base xl:mb-4";

export const ADDRESS_TOOLBAR_MOBILE_WRAP = "flex flex-col gap-3 mb-6 lg:hidden";

export const ADDRESS_TOOLBAR_DESKTOP = "hidden lg:flex items-center gap-3 mb-5 xl:gap-4 xl:mb-6";

export const ADDRESS_SEARCH_INPUT_DESKTOP =
  "h-9 w-56 shrink-0 rounded-full bg-zinc-100 border border-zinc-300 px-4 text-sm font-normal text-black placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 xl:h-11 xl:w-72 xl:px-5 xl:text-base";

export const ADDRESS_ADD_PILL_DESKTOP_ENABLED =
  "h-9 shrink-0 rounded-full px-4 text-sm font-normal transition-colors xl:h-11 xl:px-6 xl:text-base bg-zinc-300 text-black hover:bg-zinc-400 cursor-pointer";

export const ADDRESS_ADD_PILL_DESKTOP_DISABLED =
  "h-9 shrink-0 rounded-full px-4 text-sm font-normal transition-colors xl:h-11 xl:px-6 xl:text-base bg-zinc-200 text-zinc-400 cursor-not-allowed";

export const ADDRESS_ADD_PILL_MOBILE_ENABLED =
  "w-full h-11 px-6 rounded-full text-base font-normal transition-colors bg-zinc-300 text-black hover:bg-zinc-400 cursor-pointer";

export const ADDRESS_ADD_PILL_MOBILE_DISABLED =
  "w-full h-11 px-6 rounded-full text-base font-normal transition-colors bg-zinc-200 text-zinc-400 cursor-not-allowed";

export const ADDRESS_SEARCH_INPUT_MOBILE =
  "w-full h-11 px-5 rounded-full bg-zinc-100 border border-zinc-300 text-black text-base font-normal placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400";

export const ADDRESS_EMPTY_STATE =
  "flex items-center justify-center py-16 text-sm text-zinc-400 xl:text-base";

export const ADDRESS_LIST_WRAP =
  "space-y-4 lg:space-y-0 lg:divide-y lg:divide-zinc-300 lg:border lg:border-zinc-300 lg:rounded-xl lg:overflow-visible";

export const PAGINATION_ROW = "flex items-center justify-center gap-2 sm:gap-4 pb-4 md:pb-8 px-2";

export const PAGINATION_ICON_BUTTON =
  "w-11 h-11 bg-zinc-300 rounded-3xl flex items-center justify-center hover:bg-zinc-400 transition-colors cursor-pointer";

export const PAGINATION_ICON_BUTTON_DISABLED =
  "w-11 h-11 bg-zinc-100 rounded-3xl flex items-center justify-center cursor-not-allowed opacity-40";

export const PAGINATION_PAGE_ACTIVE =
  "min-w-[2.75rem] h-11 rounded-3xl flex items-center justify-center text-base font-manrope text-black cursor-pointer transition-colors bg-zinc-300 font-semibold ring-2 ring-zinc-500 ring-offset-2 hover:bg-zinc-400";

export const PAGINATION_PAGE_IDLE =
  "min-w-[2.75rem] h-11 rounded-3xl flex items-center justify-center text-base font-manrope text-black cursor-pointer transition-colors hover:bg-zinc-100 hover:underline";

export const PAGINATION_ICON_COLOR = "black";
export const PAGINATION_ICON_DISABLED_COLOR = "#a1a1aa";

/**
 * Desktop-only header row for the address list rendered once in AddressSection above the
 * address cards. Horizontal padding matches ADDRESS_CARD_ROOT_BASE (md:px-2.5 lg:px-3 xl:px-5).
 */
export const ADDRESS_DESKTOP_HDR_ROW =
  "hidden lg:grid lg:px-3 xl:px-5 mb-1 xl:mb-2";

/** Modal overlay: fixed full-screen backdrop. */
export const MODAL_OVERLAY =
  "fixed inset-0 z-50 flex items-center justify-center bg-black/40";

/** Modal panel: centered white card. */
export const MODAL_PANEL =
  "relative bg-white rounded-xl border border-zinc-200 shadow-lg p-6 max-w-sm w-full mx-4";

/** Modal title. */
export const MODAL_TITLE = "text-base font-semibold text-black mb-2";

/** Modal body text. */
export const MODAL_MESSAGE = "text-sm text-black mb-5";

/** Error popup dismiss button (full-width outline pill). */
export const ERROR_POPUP_DISMISS_BUTTON =
  "h-11 w-full rounded-full border border-zinc-300 bg-white text-black text-base font-normal hover:bg-zinc-400/30 transition-colors cursor-pointer";

/** Error popup top-right close icon button. */
export const ERROR_POPUP_CLOSE_ICON =
  "absolute top-4 right-4 w-8 h-8 rounded-md border border-zinc-300 flex items-center justify-center text-black hover:bg-zinc-100 transition-colors cursor-pointer";

/** Spinner shown inside the optimizing modal. */
export const OPTIMIZING_SPINNER =
  "inline-block h-8 w-8 rounded-full border-4 border-zinc-300 border-t-zinc-700 animate-spin";
