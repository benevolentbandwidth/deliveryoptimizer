// Results page: route list + map

"use client";

import { useCallback, useEffect, useState } from "react";
import MapComponent from "./components/Map";
import Sidebar from "./components/Sidebar";
import type { PendingPinMove, Route } from "./types";

export default function ResultsPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("optimizeResults");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Route[];
      sessionStorage.removeItem("optimizeResults"); // consume once — prevents stale data on refresh
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoutes(parsed);
    } catch {
      setError("Route data could not be loaded. Please go back and try again.");
    }
  }, []);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingPinMove, setPendingPinMove] = useState<PendingPinMove | null>(null);

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

  const handleEditModeChange = useCallback((value: boolean) => {
    setIsEditMode(value);
    if (!value) setPendingPinMove(null);
  }, []);

  const savePendingPinMove = useCallback(() => {
    if (!pendingPinMove) return;
    setRoutes((prev) =>
      prev.map((route) =>
        route.vehicleId !== pendingPinMove.vehicleId
          ? route
          : {
              ...route,
              stops: route.stops.map((s) =>
                s.id !== pendingPinMove.stopId
                  ? s
                  : { ...s, lat: pendingPinMove.lat, lng: pendingPinMove.lng }
              ),
            }
      )
    );
    setPendingPinMove(null);
  }, [pendingPinMove]);

  const handlePendingPinMove = useCallback(
    (vehicleId: string, stopId: string, lat: number, lng: number) => {
      setPendingPinMove({ vehicleId, stopId, lat, lng });
    },
    []
  );

  const cancelPendingPinMove = useCallback(() => setPendingPinMove(null), []);

  return (
    <main className="h-screen flex flex-col overflow-hidden">
      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm w-80 space-y-4">
            <p className="text-sm text-zinc-700">{error}</p>
            <a
              href="/edit"
              className="inline-flex w-full items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500"
            >
              Go back to edit
            </a>
          </div>
        </div>
      )} {/* Map container switched to h-screen and added overflow hidden so the page is forced to be exactly one screen tall, whereas before the page was allowed to get taller than browser window leading to a long scroll */}
      <header className="flex items-center gap-2 p-4 shrink-0 border-b border-zinc-200 bg-white">
        <button
          type="button"
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-2xl font-semibold text-zinc-800">Results – Route map</h1>
        {pendingPinMove != null && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={cancelPendingPinMove}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={savePendingPinMove}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
            >
              Save
            </button>
          </div>
        )}
      </header>
      <div className="flex flex-1 min-h-0">
        <div
          className={`shrink-0 h-full overflow-hidden transition-[width] duration-300 ease-in-out ${isSidebarOpen ? "w-72" : "w-0"}`}
        >
          <Sidebar
            routes={routes}
            isEditMode={isEditMode}
            onEditModeChange={handleEditModeChange}
            onUpdateStopNote={updateStopNote}
          />
        </div>
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 w-full overflow-hidden">
            <MapComponent
              routes={routes}
              isEditMode={isEditMode}
              pendingPinMove={pendingPinMove}
              onPendingPinMove={handlePendingPinMove}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
