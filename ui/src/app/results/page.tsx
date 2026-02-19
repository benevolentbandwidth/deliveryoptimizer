// Results page: holds route in state, renders sidebar (route list) and map
// Sidebar is collapsible via hamburger toggle

"use client";

import { useState, useEffect } from "react";
import MapComponent from "./components/Map";
import Sidebar from "./components/Sidebar";
import { mockRouteToRoute } from "./data/mockRouteLoader";
import type { Route } from "./types";
import type { MockRouteJson } from "./data/mockRouteLoader";
import mockRouteJson from "./data/mock_route.json";

export default function ResultsPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // initial state for sidebar is open

  useEffect(() => {
    const route = mockRouteToRoute(mockRouteJson as MockRouteJson);
    setRoutes([route]); // sets routes to an array containing the route
  }, []);

  return (
    <main className="min-h-screen flex flex-col">
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
          className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out ${isSidebarOpen ? "w-72" : "w-0"}`} // Before the sidebar only rendered when open, so it popped in with no transition. Now the sidebar is always in the page and placed inside a wrapper div that acts like a window. We change the width of that window so when open it is 288px wide and when closed it is 0px
        >                                                                                                                     {/* And since sidebar is always in the page (288px wide), overflow hidden helps prevent it from sticking out when the wrapper is 0px. Transition makes sure as the width changes, animate it over 300ms instead of jumping in/out abruptly */}
          <Sidebar routes={routes} />
        </div>
        <div className="flex-1 min-w-0 min-h-[70vh] px-4 pb-4">
          <MapComponent routes={routes} /> {/* Render the map component and pass routes */}
        </div>
      </div>
    </main>
  );
}
