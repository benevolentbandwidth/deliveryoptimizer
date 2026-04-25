// Sidebar: route cards, expand/collapse stops, edit-mode toggle.

import { useMemo, useState } from "react";
import type { Route } from "../types";
import EditableStopItem from "./EditableStopItem";

type SidebarProps = {
  routes: Route[];
  isEditMode: boolean;
  onEditModeChange: (value: boolean) => void;
  onUpdateStopNote: (routeId: string, stopId: string, note: string) => void;
};

export default function Sidebar({ routes, isEditMode, onEditModeChange, onUpdateStopNote }: SidebarProps) {
  const [expandedRouteIds, setExpandedRouteIds] = useState<Set<string>>(() => new Set());

  const totalStops = useMemo(
    () => routes.reduce((sum, r) => sum + r.stops.length, 0),
    [routes]
  );

  function toggleExpanded(routeId: string) {
    setExpandedRouteIds((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) next.delete(routeId);
      else next.add(routeId);
      return next;
    });
  }

  function formatEstTime(minutes: number | undefined): string {
    if (minutes == null) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h${m}m`;
  }

  return (
    <aside
      className={`w-full h-full flex flex-col overflow-hidden border-r-2 bg-white p-4 ${isEditMode ? "border-amber-500" : "border-zinc-200"}`}
    >
      {isEditMode && (
        <p className="mb-2 text-xs font-medium text-amber-700 bg-amber-50 rounded px-2 py-1">Edit Mode Active</p>
      )}
      <div className="flex shrink-0 items-center justify-between gap-2 mb-4">
        <span className="text-sm font-medium text-zinc-700">Edit mode</span>
        <button
          type="button"
          role="switch"
          aria-checked={isEditMode}
          onClick={() => onEditModeChange(!isEditMode)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500 ${isEditMode ? "border-amber-500 bg-amber-500" : "border-zinc-200 bg-zinc-100"}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${isEditMode ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </button>
      </div>
      <h2 className="shrink-0 text-lg font-semibold text-zinc-800">Optimized Routes</h2>
      <p className="mt-1 shrink-0 text-xs text-zinc-500">
        {routes.length} route{routes.length === 1 ? "" : "s"} with {totalStops} total stop
        {totalStops === 1 ? "" : "s"}
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto mt-3">
        {routes.length === 0 ? (
          <p className="text-sm text-zinc-500">No routes yet</p>
        ) : (
          <ul className="space-y-3 pb-2">
            {routes.map((route, idx) => {
              const isExpanded = expandedRouteIds.has(route.vehicleId);
              const sortedStops = [...route.stops].sort((a, b) => a.sequence - b.sequence);

              return (
                <li
                  key={route.vehicleId}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(route.vehicleId)}
                    className="w-full p-3 flex items-center justify-between gap-3 text-left hover:bg-zinc-100/80 transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-800">Route {idx + 1}</span>
                        <span className="text-xs text-zinc-500">{route.vehicleType ?? "Vehicle"} {route.vehicleId}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-white px-2 py-1.5 shadow-sm min-w-0 text-center">
                          <div className="text-[9px] uppercase tracking-wide text-zinc-500">STOPS</div>
                          <div className="text-sm font-semibold text-zinc-800">{sortedStops.length}</div>
                        </div>
                        <div className="rounded-lg bg-white px-2 py-1.5 shadow-sm min-w-0 text-center">
                          <div className="text-[9px] uppercase tracking-wide text-zinc-500">DISTANCE</div>
                          <div className="text-sm font-semibold text-zinc-800 tabular-nums">{route.distanceMi != null ? `${route.distanceMi}mi` : "—"}</div>
                        </div>
                        <div className="rounded-lg bg-white px-2 py-1.5 shadow-sm min-w-0 text-center">
                          <div className="text-[9px] uppercase tracking-wide text-zinc-500">EST. TIME</div>
                          <div className="text-sm font-semibold text-zinc-800 tabular-nums">{formatEstTime(route.estimatedTimeMinutes)}</div>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-zinc-600">
                        <span className="font-medium text-zinc-700">Driver:</span> {route.driverName}
                      </p>
                    </div>

                    <svg
                      className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
                        isExpanded ? "rotate-90" : "rotate-0"
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.21 14.77a.75.75 0 0 1 .02-1.06L10.94 10 7.23 6.29a.75.75 0 1 1 1.06-1.06l4.24 4.24c.3.3.3.77 0 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-zinc-200 bg-zinc-100/50 p-3">
                      <ul className="space-y-2">
                        {sortedStops.map((stop) => (
                          <li key={stop.id}>
                            <EditableStopItem
                              stop={stop}
                              isEditMode={isEditMode}
                              onSaveNote={(note) => onUpdateStopNote(route.vehicleId, stop.id, note)}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
