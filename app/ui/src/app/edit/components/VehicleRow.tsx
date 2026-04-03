"use client";

/**
 * One vehicle in the grid: read-only summary, full-width edit for existing rows, or inline new row.
 * Desktop: seven-column grid cells. Mobile: stacked card with labels above fields.
 *
 * The `layout` prop is kept because mobile vs desktop differ in real structure (stacked card vs
 * grid fragments), not only responsive CSS on one tree.
 */

import { useRef, type ReactNode } from "react";
import { TIME_OPTIONS } from "../constants/timeOptions";
import type { VehicleRow as VehicleRowType, VehicleType, CapacityUnit } from "../types/delivery";
import { capitalize } from "../utils/deliveryHelpers";
import {
  DESKTOP_VEHICLE_GRID_CLASS,
  MOBILE_FIELD_LABEL,
  VEHICLE_AVAILABLE_SEGMENT_BUTTON,
  VEHICLE_AVAILABLE_SEGMENT_READ_ONLY_SPAN,
  VEHICLE_AVAILABLE_SEGMENT_ROW,
  VEHICLE_AVAILABLE_SEGMENT_THUMB,
  VEHICLE_AVAILABLE_SEGMENT_THUMB_NO,
  VEHICLE_AVAILABLE_SEGMENT_THUMB_YES,
  VEHICLE_AVAILABLE_SEGMENTED_TRACK,
  VEHICLE_AVAILABLE_SEGMENT_WRAPPER,
  VEHICLE_CONFIRM_DESKTOP,
  VEHICLE_DESKTOP_DEPARTURE_SELECT,
  VEHICLE_DESKTOP_EDITING_PANEL,
  VEHICLE_DESKTOP_INPUT,
  VEHICLE_DESKTOP_NUMBER_INPUT,
  VEHICLE_DESKTOP_SELECT,
  VEHICLE_DESKTOP_WIDE_INPUT,
  VEHICLE_GRID_INNER,
  VEHICLE_LOCKED_CELL,
  VEHICLE_MOBILE_CARD,
  VEHICLE_MOBILE_EDITING_CARD,
  VEHICLE_MOBILE_INPUT,
  VEHICLE_MOBILE_SELECT,
  VEHICLE_PILL_FULL_DANGER,
  VEHICLE_PILL_FULL_PRIMARY,
  VEHICLE_PILL_HALF,
  VEHICLE_PILL_HALF_DANGER,
  ICON_BUTTON_9,
  ICON_BUTTON_9_DANGER,
  VEHICLE_DESKTOP_ACTION_CELL,
  VEHICLE_DESKTOP_AVAILABLE_CELL,
  VEHICLE_DESKTOP_LOCKED_TEXT,
  VEHICLE_MOBILE_AVAILABLE_LABEL,
  VEHICLE_MOBILE_AVAILABLE_ROW,
  VEHICLE_MOBILE_EDITING_ACTIONS,
  VEHICLE_MOBILE_LOCKED_ACTIONS,
  VEHICLE_MOBILE_LOCKED_TEXT,
  fieldBorder,
} from "../formStyles";

type VehicleLayout = "desktop" | "mobile";

type VehicleRowProps = {
  layout?: VehicleLayout;
  vehicle: VehicleRowType;
  vehiclesCount: number;
  updateVehicle: <K extends keyof VehicleRowType>(id: number, key: K, value: VehicleRowType[K]) => void;
  deleteVehicle: (id: number) => void;
  unlockVehicle: (id: number) => void;
  confirmVehicle: (id: number) => void;
  vehicleTouched: boolean;
};

function MobileFieldLabel({ children }: { children: ReactNode }) {
  return <span className={MOBILE_FIELD_LABEL}>{children}</span>;
}

function AvailableSegmented({
  available,
  onChange,
}: {
  available: boolean;
  onChange?: (next: boolean) => void;
}) {
  const readOnly = onChange == null;
  const noRef = useRef<HTMLButtonElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    if (readOnly) return;
    const next = !available;
    onChange?.(next);
    // Move focus to the newly activated option after re-render
    requestAnimationFrame(() => {
      (next ? yesRef : noRef).current?.focus();
    });
  }

  const trackClass = `${VEHICLE_AVAILABLE_SEGMENTED_TRACK}${readOnly ? " pointer-events-none" : ""}`;
  const thumbClass = `${VEHICLE_AVAILABLE_SEGMENT_THUMB} ${available ? VEHICLE_AVAILABLE_SEGMENT_THUMB_YES : VEHICLE_AVAILABLE_SEGMENT_THUMB_NO}`;

  return (
    <div role="radiogroup" aria-label="Available" className={trackClass}>
      <div className={thumbClass} aria-hidden />
      <div className={VEHICLE_AVAILABLE_SEGMENT_ROW}>
        {readOnly ? (
          <>
            <span role="radio" aria-checked={!available} className={VEHICLE_AVAILABLE_SEGMENT_READ_ONLY_SPAN}>
              No
            </span>
            <span role="radio" aria-checked={available} className={VEHICLE_AVAILABLE_SEGMENT_READ_ONLY_SPAN}>
              Yes
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              role="radio"
              aria-checked={!available}
              ref={noRef}
              className={VEHICLE_AVAILABLE_SEGMENT_BUTTON}
              onClick={() => onChange(false)}
              onKeyDown={handleKeyDown}
            >
              No
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={available}
              ref={yesRef}
              className={VEHICLE_AVAILABLE_SEGMENT_BUTTON}
              onClick={() => onChange(true)}
              onKeyDown={handleKeyDown}
            >
              Yes
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const TRASH_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export default function VehicleRow({
  layout = "desktop",
  vehicle: v,
  vehiclesCount,
  updateVehicle,
  deleteVehicle,
  unlockVehicle,
  confirmVehicle,
  vehicleTouched,
}: VehicleRowProps) {
  const nameInvalid = vehicleTouched && !v.name.trim();
  const startLocationInvalid = vehicleTouched && !(v.startLocation ?? "").trim();
  const typeInvalid = vehicleTouched && !v.type;
  const capMeasureInvalid = vehicleTouched && !v.capacityUnit;
  const capacityInvalid = vehicleTouched && v.capacity <= 0;
  const departureInvalid = vehicleTouched && !v.departureTime.trim();

  const inputClass = (invalid: boolean) => `${VEHICLE_MOBILE_INPUT} ${fieldBorder(invalid, "mobile")}`;
  const selectClass = (invalid: boolean) => `${VEHICLE_MOBILE_SELECT} ${fieldBorder(invalid, "mobile")}`;
  if (layout === "mobile") {
    // Locked read-only card
    if (v.locked) {
      return (
        <div className={VEHICLE_MOBILE_CARD}>
          <MobileFieldLabel>Name</MobileFieldLabel>
          <div className={VEHICLE_LOCKED_CELL}>
            <span className={VEHICLE_MOBILE_LOCKED_TEXT}>{v.name}</span>
          </div>
          <MobileFieldLabel>Start Location</MobileFieldLabel>
          <div className={VEHICLE_LOCKED_CELL}>
            <span className={VEHICLE_MOBILE_LOCKED_TEXT}>{v.startLocation}</span>
          </div>
          <MobileFieldLabel>Type</MobileFieldLabel>
          <div className={VEHICLE_LOCKED_CELL}>
            <span className={VEHICLE_MOBILE_LOCKED_TEXT}>{capitalize(v.type)}</span>
          </div>
          <MobileFieldLabel>Capacity Unit</MobileFieldLabel>
          <div className={VEHICLE_LOCKED_CELL}>
            <span className={VEHICLE_MOBILE_LOCKED_TEXT}>{capitalize(v.capacityUnit)}</span>
          </div>
          <MobileFieldLabel>Capacity</MobileFieldLabel>
          <div className={VEHICLE_LOCKED_CELL}>
            <span className={VEHICLE_MOBILE_LOCKED_TEXT}>{v.capacity}</span>
          </div>
          <div className={VEHICLE_MOBILE_AVAILABLE_ROW}>
            <span className={VEHICLE_MOBILE_AVAILABLE_LABEL}>Available</span>
            <div className={VEHICLE_AVAILABLE_SEGMENT_WRAPPER}>
              <AvailableSegmented available={v.available} />
            </div>
          </div>
          <MobileFieldLabel>Departure Time</MobileFieldLabel>
          <div className={VEHICLE_LOCKED_CELL}>
            <span className={VEHICLE_MOBILE_LOCKED_TEXT}>{v.departureTime}</span>
          </div>
          <div className={VEHICLE_MOBILE_LOCKED_ACTIONS}>
            <button
              type="button"
              onClick={() => unlockVehicle(v.id)}
              className={VEHICLE_PILL_HALF}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => deleteVehicle(v.id)}
              disabled={vehiclesCount <= 1}
              className={VEHICLE_PILL_HALF_DANGER}
            >
              Delete
            </button>
          </div>
        </div>
      );
    }

    // Editing (existing or new) shared fields; wrapper and actions differ by editingExisting
    return (
      <div className={v.editingExisting ? VEHICLE_MOBILE_EDITING_CARD : VEHICLE_MOBILE_CARD}>
        <MobileFieldLabel>Name</MobileFieldLabel>
        <input
          value={v.name}
          onChange={(e) => updateVehicle(v.id, "name", e.target.value)}
          className={`${inputClass(nameInvalid)} bg-white`}
          placeholder="Name"
          aria-label="Vehicle name"
        />
        <MobileFieldLabel>Start Location</MobileFieldLabel>
        <input
          value={v.startLocation ?? ""}
          onChange={(e) => updateVehicle(v.id, "startLocation", e.target.value)}
          className={`${inputClass(startLocationInvalid)} bg-white`}
          placeholder="Address"
          aria-label="Start location"
        />
        <MobileFieldLabel>Type</MobileFieldLabel>
        <select
          value={v.type}
          onChange={(e) => updateVehicle(v.id, "type", e.target.value as VehicleType)}
          className={`${selectClass(typeInvalid)} bg-white`}
          aria-label="Vehicle type"
        >
          <option value="" disabled>
            Select
          </option>
          <option value="truck">Truck</option>
          <option value="car">Car</option>
          <option value="bicycle">Bicycle</option>
        </select>
        <MobileFieldLabel>Capacity Unit</MobileFieldLabel>
        <select
          value={v.capacityUnit}
          onChange={(e) => updateVehicle(v.id, "capacityUnit", e.target.value as CapacityUnit)}
          className={`${selectClass(capMeasureInvalid)} bg-white`}
          aria-label="Capacity unit"
        >
          <option value="" disabled>
            Select
          </option>
          <option value="units">Units</option>
          <option value="lbs">Lbs</option>
          <option value="kgs">Kgs</option>
          <option value="volume">Volume</option>
        </select>
        <MobileFieldLabel>Capacity</MobileFieldLabel>
        <input
          type="number"
          min={0}
          value={v.capacity || ""}
          onChange={(e) => updateVehicle(v.id, "capacity", e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0)}
          className={`${inputClass(capacityInvalid)} bg-white`}
          placeholder=""
          aria-label="Vehicle capacity"
        />
        <div className={VEHICLE_MOBILE_AVAILABLE_ROW}>
          <span className={VEHICLE_MOBILE_AVAILABLE_LABEL}>Available</span>
          <div className={VEHICLE_AVAILABLE_SEGMENT_WRAPPER}>
            <AvailableSegmented
              available={v.available}
              onChange={(next) => updateVehicle(v.id, "available", next)}
            />
          </div>
        </div>
        <MobileFieldLabel>Departure time</MobileFieldLabel>
        <select
          value={v.departureTime}
          onChange={(e) => updateVehicle(v.id, "departureTime", e.target.value)}
          className={`${selectClass(departureInvalid)} bg-white`}
          aria-label="Departure time"
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
        {v.editingExisting ? (
          <div className={VEHICLE_MOBILE_EDITING_ACTIONS}>
            <button
              type="button"
              onClick={() => confirmVehicle(v.id)}
              className={VEHICLE_PILL_FULL_PRIMARY}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => deleteVehicle(v.id)}
              disabled={vehiclesCount <= 1}
              className={VEHICLE_PILL_FULL_DANGER}
            >
              Delete
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => deleteVehicle(v.id)}
            disabled={vehiclesCount <= 1}
            className={`${VEHICLE_PILL_FULL_DANGER} mt-2`}
          >
            Delete
          </button>
        )}
      </div>
    );
  }

  // --- Desktop layout ---

  // Locked: gray cells mirroring the grid columns; unlock or delete
  if (v.locked) {
    return (
      <>
        <div className={VEHICLE_LOCKED_CELL}>
          <span className={VEHICLE_DESKTOP_LOCKED_TEXT}>{v.name}</span>
        </div>
        <div className={VEHICLE_LOCKED_CELL}>
          <span className={VEHICLE_DESKTOP_LOCKED_TEXT}>{v.startLocation}</span>
        </div>
        <div className={VEHICLE_LOCKED_CELL}>
          <span className={VEHICLE_DESKTOP_LOCKED_TEXT}>{capitalize(v.type)}</span>
        </div>
        <div className={VEHICLE_LOCKED_CELL}>
          <span className={VEHICLE_DESKTOP_LOCKED_TEXT}>{capitalize(v.capacityUnit)}</span>
        </div>
        <div className={VEHICLE_LOCKED_CELL}>
          <span className={VEHICLE_DESKTOP_LOCKED_TEXT}>{v.capacity}</span>
        </div>
        <div className={VEHICLE_DESKTOP_AVAILABLE_CELL}>
          <AvailableSegmented available={v.available} />
        </div>
        <div className={VEHICLE_LOCKED_CELL}>
          <span className={VEHICLE_DESKTOP_LOCKED_TEXT}>{v.departureTime}</span>
        </div>
        <div className={VEHICLE_DESKTOP_ACTION_CELL}>
          <button
            type="button"
            onClick={() => unlockVehicle(v.id)}
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
            onClick={() => deleteVehicle(v.id)}
            disabled={vehiclesCount <= 1}
            className={ICON_BUTTON_9_DANGER}
            title="Delete"
          >
            {TRASH_ICON}
          </button>
        </div>
      </>
    );
  }

  // Editing (existing: full-width blue panel) or new row (inline in the grid).
  // The only structural differences are the wrapper div and the Confirm button.
  const actionCell = (
    <div className={VEHICLE_DESKTOP_ACTION_CELL}>
      {v.editingExisting && (
        <button
          type="button"
          onClick={() => confirmVehicle(v.id)}
          className={VEHICLE_CONFIRM_DESKTOP}
          title="Confirm edits"
        >
          Confirm
        </button>
      )}
      <button
        type="button"
        onClick={() => deleteVehicle(v.id)}
        disabled={vehiclesCount <= 1}
        className={ICON_BUTTON_9_DANGER}
        title="Delete"
      >
        {TRASH_ICON}
      </button>
    </div>
  );

  const fieldCells = (
    <>
      <input
        value={v.name}
        onChange={(e) => updateVehicle(v.id, "name", e.target.value)}
        className={`${VEHICLE_DESKTOP_INPUT} ${fieldBorder(vehicleTouched && !v.name.trim())}`}
        placeholder=""
        aria-label="Vehicle name"
      />
      <input
        value={v.startLocation ?? ""}
        onChange={(e) => updateVehicle(v.id, "startLocation", e.target.value)}
        className={`${VEHICLE_DESKTOP_WIDE_INPUT} ${fieldBorder(startLocationInvalid)}`}
        placeholder=""
        aria-label="Start location"
      />
      <select
        value={v.type}
        onChange={(e) => updateVehicle(v.id, "type", e.target.value as VehicleType)}
        className={`${VEHICLE_DESKTOP_SELECT} ${fieldBorder(vehicleTouched && !v.type)}`}
        aria-label="Vehicle type"
      >
        <option value="" disabled>
          Select
        </option>
        <option value="truck">Truck</option>
        <option value="car">Car</option>
        <option value="bicycle">Bicycle</option>
      </select>
      <select
        value={v.capacityUnit}
        onChange={(e) => updateVehicle(v.id, "capacityUnit", e.target.value as CapacityUnit)}
        className={`${VEHICLE_DESKTOP_SELECT} ${fieldBorder(vehicleTouched && !v.capacityUnit)}`}
        aria-label="Capacity unit"
      >
        <option value="" disabled>
          Select
        </option>
        <option value="units">Units</option>
        <option value="lbs">Lbs</option>
        <option value="kgs">Kgs</option>
        <option value="volume">Volume</option>
      </select>
      <input
        type="number"
        min={0}
        value={v.capacity || ""}
        onChange={(e) => updateVehicle(v.id, "capacity", e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0)}
        className={`${VEHICLE_DESKTOP_NUMBER_INPUT} ${fieldBorder(vehicleTouched && v.capacity <= 0)}`}
        placeholder=""
        aria-label="Vehicle capacity"
      />
      <div className={VEHICLE_DESKTOP_AVAILABLE_CELL}>
        <AvailableSegmented
          available={v.available}
          onChange={(next) => updateVehicle(v.id, "available", next)}
        />
      </div>
      <select
        value={v.departureTime}
        onChange={(e) => updateVehicle(v.id, "departureTime", e.target.value)}
        className={`${VEHICLE_DESKTOP_DEPARTURE_SELECT} ${fieldBorder(vehicleTouched && !v.departureTime.trim())}`}
        aria-label="Departure time"
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
      {actionCell}
    </>
  );

  if (v.editingExisting) {
    return (
      <>
        <div className={VEHICLE_DESKTOP_EDITING_PANEL}>
          <div className={`grid ${DESKTOP_VEHICLE_GRID_CLASS} ${VEHICLE_GRID_INNER}`}>
            {fieldCells}
          </div>
        </div>
      </>
    );
  }

  return <>{fieldCells}</>;
}
