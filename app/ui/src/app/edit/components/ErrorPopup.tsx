"use client";

/**
 * Modal popup for surfacing a single error message to the user.
 * Renders nothing when `message` is null.
 */

import {
  ERROR_POPUP_CLOSE_ICON,
  ERROR_POPUP_DISMISS_BUTTON,
  ERROR_POPUP_MESSAGE,
  ERROR_POPUP_OVERLAY,
  ERROR_POPUP_PANEL,
  ERROR_POPUP_TITLE,
} from "../formStyles";

type ErrorPopupProps = {
  message: string | null;
  onClose: () => void;
};

export default function ErrorPopup({ message, onClose }: ErrorPopupProps) {
  if (!message) return null;

  return (
    <div className={ERROR_POPUP_OVERLAY} role="dialog" aria-modal="true" aria-labelledby="error-popup-title">
      <div className={ERROR_POPUP_PANEL}>
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
        <p id="error-popup-title" className={ERROR_POPUP_TITLE}>Something went wrong</p>
        <p className={ERROR_POPUP_MESSAGE}>{message}</p>
        <button type="button" onClick={onClose} className={ERROR_POPUP_DISMISS_BUTTON}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
