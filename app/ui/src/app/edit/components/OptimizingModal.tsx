"use client";

import { useEffect, useRef } from "react";
import {
  ERROR_POPUP_MESSAGE,
  ERROR_POPUP_OVERLAY,
  ERROR_POPUP_PANEL,
  ERROR_POPUP_TITLE,
  OPTIMIZING_SPINNER,
} from "../formStyles";

type OptimizingModalProps = {
  isOpen: boolean;
};

export default function OptimizingModal({ isOpen }: OptimizingModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      panelRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

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
        tabIndex={-1}
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