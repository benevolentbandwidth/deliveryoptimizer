"use client";

/**
 * Top bar: branding placeholder and primary delivery actions (save, export, optimize).
 */

import {
  NAVBAR_ACTIONS_WRAP,
  NAVBAR_HEADER,
  NAVBAR_ICON_BUTTON,
  NAVBAR_LOGO_PLACEHOLDER,
  NAVBAR_OUTLINE_PILL,
  NAVBAR_SOLID_PILL,
} from "../formStyles";

export default function Navbar() {
  return (
    <header className={NAVBAR_HEADER}>
      <div className={NAVBAR_LOGO_PLACEHOLDER}>logo</div>
      <div className={NAVBAR_ACTIONS_WRAP}>
        {/* Upload icon button */}
        <button className={NAVBAR_ICON_BUTTON} aria-label="Upload">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 13V4M10 4L6 8M10 4L14 8" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4 14v1a2 2 0 002 2h8a2 2 0 002-2v-1" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>        <button className={NAVBAR_OUTLINE_PILL}>
          Save
        </button>
        <button className={NAVBAR_OUTLINE_PILL}>
          Export
        </button>
        <button className={NAVBAR_SOLID_PILL}>
          Optimize
        </button>
      </div>
    </header>
  );
}
