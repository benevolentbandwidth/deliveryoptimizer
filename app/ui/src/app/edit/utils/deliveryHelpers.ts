/**
 * Shared helpers for delivery edit flows (formatting, validation, etc.).
 * Place cross-cutting utilities here so hooks and components stay thin.
 */

/** Capitalise the first letter of a string. Safe on empty strings. */
export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
