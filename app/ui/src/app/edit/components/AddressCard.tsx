"use client";

/**
 * Single delivery stop: desktop grid, or mobile accordion with stacked fields.
 */

import { useState } from "react";
import {
  TIME_OPTIONS,
  TIME_BUFFER_OPTIONS,
  DELIVERY_BETWEEN_OPTIONS,
} from "../constants/timeOptions";
import type { AddressCard as AddressCardType } from "../types/delivery";
import {
  ADDRESS_CARD_EDITING_EXTRA,
  ADDRESS_CARD_ROOT_BASE,
  ADDRESS_COL_MIN_QTY,
  ADDRESS_COL_MIN_TIME_BUFFER,
  ADDRESS_DELIVERY_COLUMN,
  ADDRESS_DESKTOP_FIELD,
  ADDRESS_DESKTOP_GRID_GAP,
  ADDRESS_DESKTOP_HDR,
  ADDRESS_DESKTOP_MODE_SELECT,
  ADDRESS_DESKTOP_SELECT_BASE,
  ADDRESS_INPUT_DESKTOP_BASE,
  ADDRESS_LOCKED_SURFACE_MD,
  ADDRESS_NOTES_COLUMN,
  ADDRESS_NOTES_LOCKED_BOX,
  ADDRESS_TEXTAREA_EDIT,
  ACCORDION_TRIGGER,
  CONFIRM_BUTTON_DESKTOP,
  CONFIRM_PILL_MOBILE,
  DESKTOP_ADDRESS_GRID_CLASS,
  EDITING_EXISTING_HIGHLIGHT,
  ICON_BUTTON_9,
  ICON_BUTTON_9_DANGER,
  MOBILE_ADDRESS_INPUT_BASE,
  MOBILE_ADDRESS_LOCKED_ROW,
  MOBILE_ADDRESS_NOTES_AREA,
  MOBILE_ADDRESS_NOTES_TEXTAREA,
  MOBILE_ADDRESS_SELECT_MODE,
  MOBILE_DELETE_TEXT,
  MOBILE_FIELD_LABEL,
  PILL_ROW_HALF_DANGER,
  PILL_ROW_HALF_NEUTRAL,
  fieldBorder,
} from "../formStyles";

type AddressCardProps = {
  address: AddressCardType;
  addressesCount: number;
  updateAddress: <K extends keyof AddressCardType>(id: number, key: K, value: AddressCardType[K]) => void;
  deleteAddress: (id: number) => void;
  unlockAddress: (id: number) => void;
  confirmAddress: (id: number) => void;
  addressTouched: boolean;
};

export default function AddressCard({
  address: a,
  addressesCount,
  updateAddress,
  deleteAddress,
  unlockAddress,
  confirmAddress,
  addressTouched,
}: AddressCardProps) {

  const [manualExpanded, setManualExpanded] = useState(false);
  const expanded = !a.locked || manualExpanded;
  
  const addrInvalid = addressTouched && !a.recipientAddress.trim();
  const bufferInvalid = addressTouched && !a.timeBuffer;
  const deliveryTimeInvalid =
    addressTouched &&
    (a.deliveryTimeMode === "by" ? !a.deliveryBy.trim() : !a.deliveryBetween.trim());
  const qtyInvalid = addressTouched && a.deliveryQuantity <= 0;

  const mobileInputClass = (invalid: boolean) =>
    `${MOBILE_ADDRESS_INPUT_BASE} ${fieldBorder(invalid, "mobile")}`;

  const mobileSelectClass = (invalid: boolean) =>
    `${MOBILE_ADDRESS_INPUT_BASE} ${fieldBorder(invalid, "mobile")} cursor-pointer select-chevron`;

  const displayAddr = a.recipientAddress.trim() || "Address";

  // IDs for accordion ARIA: trigger controls the panel.
  const panelId = `addr-panel-${a.id}`;

  return (
    <div
      className={`${ADDRESS_CARD_ROOT_BASE} ${
        !a.locked && a.editingExisting ? `${EDITING_EXISTING_HIGHLIGHT} ${ADDRESS_CARD_EDITING_EXTRA}` : ""
      }`}
    >
      {/* Desktop layout */}
      <div className="hidden lg:block">
        <div className={`grid ${DESKTOP_ADDRESS_GRID_CLASS} ${ADDRESS_DESKTOP_GRID_GAP} items-stretch`}>
          <span className={ADDRESS_DESKTOP_HDR}>Address</span>
          <span className={ADDRESS_DESKTOP_HDR}>Time Buffer</span>
          <span className={ADDRESS_DESKTOP_HDR}>Delivery</span>
          <span className={ADDRESS_DESKTOP_HDR}>Quantity</span>
          <span className={ADDRESS_DESKTOP_HDR}>Notes</span>
          <span />
          {a.locked ? (
            <>
              <div className={ADDRESS_LOCKED_SURFACE_MD}>
                <span className={`${ADDRESS_DESKTOP_FIELD} truncate`}>{a.recipientAddress}</span>
              </div>
              <div className={`${ADDRESS_LOCKED_SURFACE_MD} ${ADDRESS_COL_MIN_TIME_BUFFER}`}>
                <span className={`${ADDRESS_DESKTOP_FIELD} truncate`}>{a.timeBuffer}</span>
              </div>
              <div className={ADDRESS_DELIVERY_COLUMN}>
                <div className={`${ADDRESS_LOCKED_SURFACE_MD} w-full`}>
                  <span className={`${ADDRESS_DESKTOP_FIELD} truncate`}>
                    {a.deliveryTimeMode === "by" ? "Delivery by" : "Delivery between"}
                  </span>
                </div>
                <div className={`${ADDRESS_LOCKED_SURFACE_MD} w-full`}>
                  <span className={`${ADDRESS_DESKTOP_FIELD} truncate`}>
                    {a.deliveryTimeMode === "by" ? a.deliveryBy : a.deliveryBetween}
                  </span>
                </div>
              </div>
              <div className={`${ADDRESS_LOCKED_SURFACE_MD} ${ADDRESS_COL_MIN_QTY}`}>
                <span className={`${ADDRESS_DESKTOP_FIELD} truncate`}>{a.deliveryQuantity}</span>
              </div>
              <div className={ADDRESS_NOTES_COLUMN}>
                <div className={ADDRESS_NOTES_LOCKED_BOX}>
                  <span className={`${ADDRESS_DESKTOP_FIELD} line-clamp-[12] leading-snug xl:leading-6`}>{a.notes}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 self-start pt-1">
                <button
                  type="button"
                  onClick={() => unlockAddress(a.id)}
                  className={ICON_BUTTON_9}
                  title="Edit"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => deleteAddress(a.id)}
                  disabled={addressesCount <= 1}
                  className={ICON_BUTTON_9_DANGER}
                  title="Delete"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                value={a.recipientAddress}
                onChange={(e) => updateAddress(a.id, "recipientAddress", e.target.value)}
                placeholder="Address"
                aria-label="Recipient address"
                className={`${ADDRESS_INPUT_DESKTOP_BASE} ${fieldBorder(addrInvalid)}`}
              />
              <select
                value={a.timeBuffer}
                onChange={(e) => updateAddress(a.id, "timeBuffer", e.target.value)}
                aria-label="Time buffer"
                className={`${ADDRESS_DESKTOP_SELECT_BASE} self-start bg-white ${ADDRESS_COL_MIN_TIME_BUFFER} ${fieldBorder(bufferInvalid)}`}
              >
                <option value="" disabled>
                  Select
                </option>
                {TIME_BUFFER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <div className={ADDRESS_DELIVERY_COLUMN}>
                <select
                  value={a.deliveryTimeMode}
                  onChange={(e) =>
                    updateAddress(a.id, "deliveryTimeMode", e.target.value as "by" | "between")
                  }
                  className={ADDRESS_DESKTOP_MODE_SELECT}
                  aria-label="Delivery time type"
                >
                  <option value="by">Delivery by</option>
                  <option value="between">Delivery between</option>
                </select>
                {a.deliveryTimeMode === "by" ? (
                  <select
                    value={a.deliveryBy}
                    onChange={(e) => updateAddress(a.id, "deliveryBy", e.target.value)}
                    className={`${ADDRESS_DESKTOP_SELECT_BASE} bg-white ${fieldBorder(deliveryTimeInvalid)}`}
                    aria-label="Delivery by time"
                  >
                    <option value="" disabled>
                      Select
                    </option>
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={a.deliveryBetween}
                    onChange={(e) => updateAddress(a.id, "deliveryBetween", e.target.value)}
                    className={`${ADDRESS_DESKTOP_SELECT_BASE} bg-white ${fieldBorder(deliveryTimeInvalid)}`}
                    aria-label="Delivery between window"
                  >
                    <option value="" disabled>
                      Select
                    </option>
                    {DELIVERY_BETWEEN_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <input
                type="number"
                min={0}
                value={a.deliveryQuantity || ""}
                onChange={(e) =>
                  updateAddress(a.id, "deliveryQuantity", e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0)
                }
                aria-label="Delivery quantity"
                className={`${ADDRESS_INPUT_DESKTOP_BASE} ${ADDRESS_COL_MIN_QTY} ${fieldBorder(qtyInvalid)}`}
              />
              <div className={ADDRESS_NOTES_COLUMN}>
                <textarea
                  value={a.notes}
                  onChange={(e) => updateAddress(a.id, "notes", e.target.value)}
                  aria-label="Notes"
                  rows={1}
                  className={ADDRESS_TEXTAREA_EDIT}
                />
              </div>
              <div className="flex items-center gap-1 self-start pt-0.5">
                {a.editingExisting && (
                  <button
                    type="button"
                    onClick={() => confirmAddress(a.id)}
                    className={CONFIRM_BUTTON_DESKTOP}
                  >
                    Confirm
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteAddress(a.id)}
                  disabled={addressesCount <= 1}
                  className={ICON_BUTTON_9_DANGER}
                  title="Delete"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile accordion */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => {
            if (a.locked) {
              setManualExpanded((e) => !e);
            } else {
              setManualExpanded(false);
            }
          }}         
          aria-expanded={expanded}
          aria-controls={panelId}
          className={ACCORDION_TRIGGER}
        >
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-black truncate">{displayAddr}</div>
          </div>
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            className={`shrink-0 text-black transition-transform mt-0.5 ${expanded ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {expanded && (
          <div id={panelId} role="region" className="p-4 space-y-3">
            {a.locked ? (
              <>
                <div>
                  <span className={MOBILE_FIELD_LABEL}>Address</span>
                  <div className={MOBILE_ADDRESS_LOCKED_ROW}>
                    <span className="text-sm text-black truncate">{a.recipientAddress}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className={MOBILE_FIELD_LABEL}>Time Buffer</span>
                    <div className={MOBILE_ADDRESS_LOCKED_ROW}>
                      <span className="text-sm text-black truncate">{a.timeBuffer}</span>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className={MOBILE_ADDRESS_LOCKED_ROW}>
                      <span className="text-sm text-black truncate">
                        {a.deliveryTimeMode === "by" ? "Delivery by" : "Delivery between"}
                      </span>
                    </div>
                    <div className={MOBILE_ADDRESS_LOCKED_ROW}>
                      <span className="text-sm text-black truncate">
                        {a.deliveryTimeMode === "by" ? a.deliveryBy : a.deliveryBetween}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <span className={MOBILE_FIELD_LABEL}>Quantity</span>
                  <div className={MOBILE_ADDRESS_LOCKED_ROW}>
                    <span className="text-sm text-black truncate">{a.deliveryQuantity}</span>
                  </div>
                </div>
                <div>
                  <span className={MOBILE_FIELD_LABEL}>Notes</span>
                  <div className={MOBILE_ADDRESS_NOTES_AREA}>
                    <span className="text-sm text-black leading-6 line-clamp-6">{a.notes}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => unlockAddress(a.id)}
                    className={PILL_ROW_HALF_NEUTRAL}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteAddress(a.id)}
                    disabled={addressesCount <= 1}
                    className={PILL_ROW_HALF_DANGER}
                  >
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className={MOBILE_FIELD_LABEL}>Address</span>
                  <input
                    value={a.recipientAddress}
                    onChange={(e) => updateAddress(a.id, "recipientAddress", e.target.value)}
                    placeholder="Address"
                    aria-label="Recipient address"
                    className={mobileInputClass(addrInvalid)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className={MOBILE_FIELD_LABEL}>Time Buffer</span>
                    <select
                      value={a.timeBuffer}
                      onChange={(e) => updateAddress(a.id, "timeBuffer", e.target.value)}
                      aria-label="Time buffer"
                      className={mobileSelectClass(bufferInvalid)}
                    >
                      <option value="" disabled>
                        Select
                      </option>
                      {TIME_BUFFER_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <select
                      value={a.deliveryTimeMode}
                      onChange={(e) =>
                        updateAddress(a.id, "deliveryTimeMode", e.target.value as "by" | "between")
                      }
                      className={`${MOBILE_ADDRESS_SELECT_MODE} ${fieldBorder(false, "mobile")}`}
                      aria-label="Delivery time type"
                    >
                      <option value="by">Delivery by</option>
                      <option value="between">Delivery between</option>
                    </select>
                    {a.deliveryTimeMode === "by" ? (
                      <select
                        value={a.deliveryBy}
                        onChange={(e) => updateAddress(a.id, "deliveryBy", e.target.value)}
                        className={mobileSelectClass(deliveryTimeInvalid)}
                        aria-label="Delivery by time"
                      >
                        <option value="" disabled>
                          Select
                        </option>
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={a.deliveryBetween}
                        onChange={(e) => updateAddress(a.id, "deliveryBetween", e.target.value)}
                        className={mobileSelectClass(deliveryTimeInvalid)}
                        aria-label="Delivery between window"
                      >
                        <option value="" disabled>
                          Select
                        </option>
                        {DELIVERY_BETWEEN_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div>
                  <span className={MOBILE_FIELD_LABEL}>Quantity</span>
                  <input
                    type="number"
                    min={0}
                    value={a.deliveryQuantity || ""}
                    onChange={(e) =>
                      updateAddress(a.id, "deliveryQuantity", e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0)
                    }
                    aria-label="Delivery quantity"
                    className={mobileInputClass(qtyInvalid)}
                  />
                </div>
                <div>
                  <span className={MOBILE_FIELD_LABEL}>Notes</span>
                  <textarea
                    value={a.notes}
                    onChange={(e) => updateAddress(a.id, "notes", e.target.value)}
                    aria-label="Notes"
                    rows={5}
                    className={MOBILE_ADDRESS_NOTES_TEXTAREA}
                  />
                </div>
                {a.editingExisting && (
                  <button
                    type="button"
                    onClick={() => confirmAddress(a.id)}
                    className={CONFIRM_PILL_MOBILE}
                  >
                    Confirm
                  </button>
                )}
                <hr className="border-zinc-200" />
                <button
                  type="button"
                  onClick={() => deleteAddress(a.id)}
                  disabled={addressesCount <= 1}
                  className={MOBILE_DELETE_TEXT}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
