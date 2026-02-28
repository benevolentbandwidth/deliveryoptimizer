// Results page: results screen that holds the route in state and renders the map component

"use client";

import { useState, useEffect } from "react";
import MapComponent from "./components/Map";
import { mockRouteToRoute } from "./data/mockRouteLoader";
import type { Route } from "./types";
import type { MockRouteJson } from "./data/mockRouteLoader";
import mockRouteJson from "./data/mock_route.json";

export default function ResultsPage() {
  const [routes, setRoutes] = useState<Route[]>([]); // creating the state for the list of routes, initial value is an empty array

  useEffect(() => { // after component is on screen, take the mockRouteJson and convert it using mockRouteToRoute into a Route object and store it in route
    const route = mockRouteToRoute(mockRouteJson as MockRouteJson);
    setRoutes([route]); // sets routes to an array containing the route
  }, []);

  return (
    <main className="min-h-screen flex flex-col">
      <h1 className="text-2xl font-semibold p-4 shrink-0">Results – Route map</h1>
      <div className="flex-1 min-h-[70vh] w-full px-4 pb-4">
        <MapComponent routes={routes} />
      </div>
    </main>
  );
}
