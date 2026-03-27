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
