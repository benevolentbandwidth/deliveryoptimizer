// Sidebar component that takes routes as a prop and renders each route's driver name and its stope in sequence order (including address)
// If no routes, it shows a message saying "no routes yet"

import { useMemo, useState } from "react";
import type { Route } from "../types";
import EditableStopItem from "./EditableStopItem";

type SidebarProps = {
  routes: Route[]; // Declaring SidebarProp receives routes prop that is an array of Route objects
  isEditMode: boolean; // Declaring SidebarProp receives a isEditMode prop that is a boolean
  onEditModeChange: (value: boolean) => void; // Declaring SidebarProp receives an onEditModeChange prop that is a function that's called to update the edit mode state (true/false) when user clicks the edit mode toggle button
  onUpdateStopNote: (routeId: string, stopId: string, note: string) => void; // from page; Sidebar passes it through to EditableStopItem as onSaveNote (wrapped with this route and stop id)
};

export default function Sidebar({ routes, isEditMode, onEditModeChange, onUpdateStopNote }: SidebarProps) { // Sidebar component receiving routes, edit mode state, and onEditModeChange from when <Sidebar> is rendered in page.tsx
  const [expandedRouteIds, setExpandedRouteIds] = useState<Set<string>>(() => new Set()); // expandedRouteIds is a set of route IDs, which remembers which route cards are expanded (showing their stops), starts empty (meaning all route cards are collapsed)

  const totalStops = useMemo( // Calculating the total number of stops in all routes
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

  // Format minutes as "3h15m" for EST. TIME in card header
  function formatEstTime(minutes: number | undefined): string {
    if (minutes == null) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h${m}m`;
  }

  return (
    <aside
      className={`w-full h-full flex flex-col overflow-hidden border-r-2 bg-white p-4 ${isEditMode ? "border-amber-500" : "border-zinc-200"}`} // h-full helps the sidebar fill up the full height of the column next to the map instead of just being as tall as its content, flex flex-col stacks the children in the column and control their height, overflow hidden makes sure scrolling only happens inside the sidebar's content area
    >
      {isEditMode && ( // If edit mode is true, show the message saying "Edit Mode Active"
        <p className="mb-2 text-xs font-medium text-amber-700 bg-amber-50 rounded px-2 py-1">Edit Mode Active</p>
      )}
      <div className="flex shrink-0 items-center justify-between gap-2 mb-4">
        <span className="text-sm font-medium text-zinc-700">Edit mode</span>
        <button
          type="button"
          role="switch" // The button is a switch that can be toggled on and off
          aria-checked={isEditMode} // Telling whether the switch is on or off
          onClick={() => onEditModeChange(!isEditMode)} // When use clicks the button, call onEditModeChange with the opposite of the current edit mode state (true -> false or false -> true)
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500 ${isEditMode ? "border-amber-500 bg-amber-500" : "border-zinc-200 bg-zinc-100"}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${isEditMode ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </button>
      </div>
      <h2 className="shrink-0 text-lg font-semibold text-zinc-800">Optimized Routes</h2> {/* Added shrink-0 on the <div> that makes the row not shrink so the toggle are present at the top */}
      <p className="mt-1 shrink-0 text-xs text-zinc-500">
        {routes.length} route{routes.length === 1 ? "" : "s"} with {totalStops} total stop
        {totalStops === 1 ? "" : "s"}
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto mt-3"> {/* The div takes up the remaining space below the fixed header and if route list is taller than that space, only this area scrolls */}
        {routes.length === 0 ? (
          <>
            {/* If no routes, show message saying "no routes yet" */}
            <p className="text-sm text-zinc-500">No routes yet</p>
          </>
        ) : (
          <ul className="space-y-3 pb-2"> {/* Place some vertical space between each route card and small padding at the bottom so last card isn't stuck to the edge when scrolling */}
            {routes.map((route, idx) => {
              const isExpanded = expandedRouteIds.has(route.vehicleId); // isExpanded is a boolean that checks if the route card is expanded (showing its stops)
              const sortedStops = [...route.stops].sort((a, b) => a.sequence - b.sequence); // sortedStops is an array of route's stops in visit order

              return (
                <li
                  key={route.vehicleId}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(route.vehicleId)}
                    className="w-full p-3 flex items-center justify-between gap-3 text-left hover:bg-zinc-100/80 transition-colors"  // Added hover:bg-zinc-100/80 transition-colors to make the card background color change when hovered over
                    aria-expanded={isExpanded}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-800">Route {idx + 1}</span>
                        <span className="text-xs text-zinc-500">{route.vehicleType ?? "Vehicle"} {route.vehicleId}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2"> {/* Here we replaced the single line of Stops, Distance, and Est. Time with a grid of three small boxes each with a white rounded box and small grey label and bold value */}
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

                  {isExpanded && ( // Below the card header, when expanded, shows one EditableStopItem per stop; each gets onSaveNote wrapped so the page's updateStopNote is called with this route and stop id
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
