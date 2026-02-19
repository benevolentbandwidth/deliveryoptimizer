// Results page: holds route in state, renders sidebar (route list) and map
// Sidebar is collapsible via hamburger toggle

"use client";

import { useCallback, useState } from "react";
import MapComponent from "./components/Map";
import Sidebar from "./components/Sidebar";
import { mockRouteToRoute } from "./data/mockRouteLoader";
import type { Route } from "./types";
import type { MockRouteJson } from "./data/mockRouteLoader";
import mockRouteJson from "./data/mock_route.json";

export default function ResultsPage() {
  const [routes, setRoutes] = useState<Route[]>(() => [mockRouteToRoute(mockRouteJson as MockRouteJson)]); // Lazy initializer: compute initial routes once so first render already has data (no empty flash, no extra re-render)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // initial state for sidebar is open
  const [isEditMode, setIsEditMode] = useState(false); // initial state for edit mode is off (false = view only, true = editing)

  // Updates one stop's note in routes state. Page owns routes, so only the page can change it; Sidebar and EditableStopItem send the new note up via the callback.
  const updateStopNote = useCallback((routeId: string, stopId: string, note: string) => {
    setRoutes((prev) =>
      prev.map((route) => {
        if (route.vehicleId !== routeId) return route;
        return {
          ...route,
          stops: route.stops.map((s) => (s.id === stopId ? { ...s, note } : s)),
        };
      })
    );
  }, [setRoutes]);

  return (
    <main className="h-screen flex flex-col overflow-hidden"> {/* Map container switched to h-screen and added overflow hidden so the page is forced to be exactly one screen tall, whereas before the page was allowed to get taller than browser window leading to a long scroll */}
      <header className="flex items-center gap-2 p-4 shrink-0 border-b border-zinc-200 bg-white">
        <button
          type="button"
          onClick={() => setIsSidebarOpen((prev) => !prev)} // On click, flip the current state of isSidebarOpen (open -> closed or closed -> open)
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50" // Making button a square with 10px height and width, centered, rounded corners, border, white background, text color, and hover effect
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden> {/* SVG: hamburger icon inside the button */}
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-2xl font-semibold text-zinc-800">Results – Route map</h1> {/* Header title */}
      </header>
      <div className="flex flex-1 min-h-0">
        <div
          className={`shrink-0 h-full overflow-hidden transition-[width] duration-300 ease-in-out ${isSidebarOpen ? "w-72" : "w-0"}`} // h-full so sidebar has a defined height for internal scrolling; overflow hidden so only the sidebar's scroll area scrolls
        >
          <Sidebar routes={routes} isEditMode={isEditMode} onEditModeChange={setIsEditMode} onUpdateStopNote={updateStopNote} /> {/* Passing the current list of routes and current edit mode state to the sidebar component */}
        </div>
        {/* Map area still uses flex flex-1 min-h-0 so it takes all space below header, and now also features min-h-0 flex flex-col so it gets a clear height from the flex layout*/}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 w-full overflow-hidden">
            <MapComponent routes={routes} />
          </div>
        </div>
      </div>
    </main>
  );
}
