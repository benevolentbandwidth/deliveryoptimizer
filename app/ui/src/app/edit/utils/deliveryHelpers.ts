/**
 * Shared helpers for delivery edit flows (formatting, validation, etc.).
 * Place cross-cutting utilities here so hooks and components stay thin.
 */

import type { AddressCard } from "../types/delivery";

/** Returns true when the active delivery-time field has a value. */
export function deliveryTimeFilled(
  a: Pick<AddressCard, "deliveryTimeMode" | "deliveryBy" | "deliveryBetween">
): boolean {
  return a.deliveryTimeMode === "by"
    ? a.deliveryBy.trim() !== ""
    : a.deliveryBetween.trim() !== "";
}

/** Capitalise the first letter of a string. Safe on empty strings. */
export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
