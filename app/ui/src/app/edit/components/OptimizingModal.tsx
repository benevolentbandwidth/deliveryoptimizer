"use client";

import {
  ERROR_POPUP_MESSAGE,
  ERROR_POPUP_OVERLAY,
  ERROR_POPUP_PANEL,
  ERROR_POPUP_TITLE,
  OPTIMIZING_SPINNER,
} from "../formStyles";
import { useFocusTrap } from "../hooks/useFocusTrap";

type OptimizingModalProps = {
  isOpen: boolean;
};

export default function OptimizingModal({ isOpen }: OptimizingModalProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen);

  if (!isOpen) return null;

  return (
    <div className={ERROR_POPUP_OVERLAY}>
      <div
        ref={panelRef}
        className={ERROR_POPUP_PANEL}
        role="dialog"
        aria-modal="true"
        aria-labelledby="optimizing-title"
        aria-describedby="optimizing-desc"
        tabIndex={0}
      >
        <h2 id="optimizing-title" className={ERROR_POPUP_TITLE}>
          Optimizing routes…
        </h2>
        <p id="optimizing-desc" className={ERROR_POPUP_MESSAGE}>
          This may take a few seconds. Please wait.
        </p>
        <div className="flex justify-center mt-2">
          <span
            className={OPTIMIZING_SPINNER}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}