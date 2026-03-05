// Results page: results screen that holds the route in state and renders the map component

"use client";

import { useState } from "react";
import MapComponent from "./components/Map";
import { mockRouteToRoute } from "./data/mockRouteLoader";
import type { Route } from "./types";
import type { MockRouteJson } from "./data/mockRouteLoader";
import mockRouteJson from "./data/mock_route.json";

export default function ResultsPage() {
  const [routes] = useState<Route[]>(() => [mockRouteToRoute(mockRouteJson as MockRouteJson)]);

  return (
    <main className="min-h-screen flex flex-col">
      <h1 className="text-2xl font-semibold p-4 shrink-0">Results – Route map</h1>
      <div className="flex-1 min-h-[70vh] w-full px-4 pb-4">
        <MapComponent routes={routes} />
      </div>
    </main>
  );
}
