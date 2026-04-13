"use client";

import {
  ERROR_POPUP_MESSAGE,
  ERROR_POPUP_OVERLAY,
  ERROR_POPUP_PANEL,
  ERROR_POPUP_TITLE,
} from "../formStyles";

type OptimizingModalProps = {
  isOpen: boolean;
};

export default function OptimizingModal({ isOpen }: OptimizingModalProps) {
  if (!isOpen) return null;

  return (
    <div className={ERROR_POPUP_OVERLAY} role="dialog" aria-modal="true" aria-live="polite">
      <div className={ERROR_POPUP_PANEL}>
        <h2 className={ERROR_POPUP_TITLE}>Optimizing routes…</h2>
        <p className={ERROR_POPUP_MESSAGE}>This may take a few seconds. Please wait.</p>
        <div className="flex justify-center mt-2">
          <span
            className="inline-block h-8 w-8 rounded-full border-4 border-zinc-300 border-t-zinc-700 animate-spin"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
