// One stop row in an expanded route card (read-only or note edit)

"use client";

import { useState } from "react";
import type { Stop } from "../types";

type EditableStopItemProps = {
  stop: Stop;
  isEditMode: boolean;
  onSaveNote: (note: string) => void;
};

export default function EditableStopItem({ stop, isEditMode, onSaveNote }: EditableStopItemProps) {
  const [draft, setDraft] = useState(stop.note ?? "");

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-600 text-xs font-semibold text-white">
            {stop.sequence}
          </span>
          <span className="text-xs font-semibold text-zinc-800 truncate">{stop.address}</span>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-md bg-zinc-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
          <span className="sr-only">Packages:</span>
          <span aria-hidden>📦</span> {stop.capacityUsed ?? "—"}
        </span>
      </div>
      <div className="mt-1.5 space-y-0.5 text-xs text-zinc-600">
        <div><span className="font-medium text-zinc-700">Name of addressed to:</span> {stop.addresseeName ?? "—"}</div>
        <div><span className="font-medium text-zinc-700">Est time of arrival:</span> {stop.timeWindow?.time ?? "—"}</div>
      </div>

      {!isEditMode ? (
        <div className="mt-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-600 shadow-sm">
          <span className="font-medium text-zinc-700">Notes:</span>{" "}
          {stop.note?.trim() ? stop.note : <span className="text-zinc-400">No notes</span>}
        </div>
      ) : (
        <div className="mt-2">
          <label className="block text-xs font-medium text-zinc-700">Notes</label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            placeholder="Driver notes (e.g., Gate code is 1234)"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onSaveNote(draft)}
              className="inline-flex items-center rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
