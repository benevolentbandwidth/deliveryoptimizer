"use client";

/**
 * Top bar: branding placeholder and primary delivery actions (save, export, optimize).
 */

import { useRef } from "react";
import {
  NAVBAR_ACTIONS_WRAP,
  NAVBAR_HEADER,
  NAVBAR_ICON_BUTTON,
  NAVBAR_LOGO_PLACEHOLDER,
  NAVBAR_OUTLINE_PILL,
  NAVBAR_SOLID_PILL,
} from "../formStyles";
import ErrorPopup from "./ErrorPopup";

type NavbarProps = {
  onOptimize: () => void;
  isOptimizing: boolean;
  error: string | null;
  onClearError: () => void;
  onCSVUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  csvFileName: string;
};

export default function Navbar({
  onOptimize,
  isOptimizing,
  error,
  onClearError,
  onCSVUpload,
  csvFileName,
}: NavbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <ErrorPopup message={error} onClose={onClearError} />
      <header className={NAVBAR_HEADER}>
        <div className={NAVBAR_LOGO_PLACEHOLDER}>logo</div>
        <div className={NAVBAR_ACTIONS_WRAP}>
          <button
            className={NAVBAR_ICON_BUTTON}
            aria-label="Upload CSV"
            title={csvFileName || "Upload CSV"}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 13V4M10 4L6 8M10 4L14 8" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 14v1a2 2 0 002 2h8a2 2 0 002-2v-1" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={onCSVUpload}
            className="hidden"
            aria-hidden
          />
          <button className={NAVBAR_OUTLINE_PILL} disabled={true}>
            Save
          </button>
          <button className={NAVBAR_OUTLINE_PILL} disabled={true}>
            Export
          </button>
          <button
            className={NAVBAR_SOLID_PILL}
            onClick={onOptimize}
            disabled={isOptimizing}
          >
            {isOptimizing ? "Optimizing…" : "Optimize"}
          </button>
        </div>
      </header>
    </>
  );
}
