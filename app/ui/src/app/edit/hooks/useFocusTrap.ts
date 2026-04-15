import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;

    // querySelectorAll only searches descendants, so include the container
    // itself if it is focusable (e.g. a panel with tabIndex={0} and no buttons)
    const focusable = () => {
      const descendants = Array.from<HTMLElement>(
        container.querySelectorAll(FOCUSABLE_SELECTORS)
      );
      return container.matches(FOCUSABLE_SELECTORS)
        ? [container as HTMLElement, ...descendants]
        : descendants;
    };

    // Focus the first focusable element when the trap activates
    focusable()[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const elements = focusable();

      // No focusable elements at all — block Tab so focus can't escape
      if (elements.length === 0) {
        e.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];

      // Shift+Tab on first element → wrap to last
      // Tab on last element → wrap to first
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  return containerRef;
}
