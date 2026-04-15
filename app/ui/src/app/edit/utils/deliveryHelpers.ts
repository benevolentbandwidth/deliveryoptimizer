/**
 * Shared helpers for delivery edit flows (formatting, validation, etc.).
 * Place cross-cutting utilities here so hooks and components stay thin.
 */

import type { AddressCard } from "../types/delivery";

/** Returns true when at least one delivery-time field has a value. */
export function deliveryTimeFilled(
  a: Pick<AddressCard, "deliveryTimeStart" | "deliveryTimeEnd">
): boolean {
  return (a.deliveryTimeStart?.trim() ?? "") !== "" || (a.deliveryTimeEnd?.trim() ?? "") !== "";
}

/** Capitalise the first letter of a string. Safe on empty strings. */
export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
