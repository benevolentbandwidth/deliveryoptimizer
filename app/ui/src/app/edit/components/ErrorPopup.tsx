"use client";

/**
 * Modal popup for surfacing a single error message to the user.
 * Renders nothing when `message` is null.
 */

import {
  ERROR_POPUP_CLOSE_ICON,
  ERROR_POPUP_DISMISS_BUTTON,
  MODAL_MESSAGE,
  MODAL_OVERLAY,
  MODAL_PANEL,
  MODAL_TITLE,
} from "../formStyles";
import { useFocusTrap } from "../hooks/useFocusTrap";

type ErrorPopupProps = {
  message: string | null;
  onClose: () => void;
};

export default function ErrorPopup({ message, onClose }: ErrorPopupProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(!!message);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!message) return null;

  return (
    <div 
    className={MODAL_OVERLAY} role="dialog" aria-modal="true" aria-labelledby="error-popup-title" onKeyDown={handleKeyDown}>
      <div ref={panelRef} className={MODAL_PANEL}>
        <button
          type="button"
          onClick={onClose}
          className={ERROR_POPUP_CLOSE_ICON}
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <h2 id="error-popup-title" className={MODAL_TITLE}>Something went wrong</h2>
        <p className={MODAL_MESSAGE}>{message}</p>
        <button type="button" onClick={onClose} className={ERROR_POPUP_DISMISS_BUTTON}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
