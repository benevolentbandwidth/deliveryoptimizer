// Map component for the Results page: Google Map, route polylines, and delivery stops as Advanced Markers (vis.gl = Google's newer API).
"use client";

import { useEffect, useRef } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap, // a hook that gets you the current map instance (from the vis.gl library)
} from "@vis.gl/react-google-maps";
import type { Route } from "../types";

const DAVIS_CENTER = { lat: 38.5449, lng: -121.7405 }; // Map center coordinates for Davis,CA (Google Maps needs as an initial center to position the initial view of the map)
const POLYLINE_COLOR = "#2563eb"; // Blue path per route (single mock route)
const DEMO_MAP_ID = "DEMO_MAP_ID"; // This is the ID of the map instance, Advance Markers needs a map id

type MapComponentProps = {
  routes: Route[];
};

// Vis.gl has no Polyline component, so we need to create one manually using the google.maps.Polyline class
// We first get the map using the useMap() hook
function MapContent({ routes }: { routes: Route[] }) { // Vis.gl has no Polyline component, 
  const map = useMap();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

// In useEffect, we first check if map is defined and routes isn't empty, otherwise we stop since we need a map and at least one route to do anything
  useEffect(() => {
    if (!map || routes.length === 0) return;
    const bounds = new google.maps.LatLngBounds(); // Creating LatLngBounds that creates an empty bounds object (box that'll stretch to fit all stops)
    routes.forEach((route) => {
      route.stops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng })); // For each route and stop, we grow the box so it includes this stop's lat/lng coordinates
    });
    map.fitBounds(bounds, 48); // Map zooms and pans so box is visible with 48 pixels of padding

    const polylines: google.maps.Polyline[] = []; // Empty array to store each route's polyline
    routes.forEach((route) => {
      const sorted = [...route.stops].sort((a, b) => a.sequence - b.sequence); // For each route, we copy the stops and sort them by visit order
      const path = sorted.map((s) => ({ lat: s.lat, lng: s.lng })); // Turn the list of stops into a list of points (lat/lng pairs), this is the path the line will follow
      const line = new google.maps.Polyline({ // Create one polyline, using the path we made, blue color, 5 pixels wide, mostly opaque, and add it to the map 
        path,
        strokeColor: POLYLINE_COLOR,
        strokeWeight: 5,
        strokeOpacity: 0.9,
        map,
      });
      polylines.push(line);
    });
    polylinesRef.current = polylines;
    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null)); // For each polyline, we remove it from the map
      polylinesRef.current = []; // Clear the array, so we don't keep old polylines around when the component re-renders
    };
  }, [map, routes]);

  return null;
}

export default function MapComponent({ routes }: MapComponentProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

  if (!apiKey) { // If the API key is not found, we return a message to the user
    return (
      <div className="min-h-[60vh] grid place-items-center bg-zinc-100 text-zinc-600">
        Missing NEXT_PUBLIC_GOOGLE_MAPS_KEY
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}> {/* APIProvider is a component that passes the Google Maps API key, makes it available for the map and markers to work (before we had to use the LoadScriptNext component)*/}
      <Map // Begin the map component
        mapId={DEMO_MAP_ID}
        defaultCenter={DAVIS_CENTER}
        defaultZoom={11}
        style={{ width: "100%", height: "100%", minHeight: "70vh" }}
        className="w-full min-h-[70vh] rounded-lg"
      >
        <MapContent routes={routes} /> {/* MapContent gets the current map with useMap(), then runs fitbounds so all stops are framed, and draws the polylines*/}
        {routes.flatMap((route) => { // For each route, list of things are returned and flat map flattens into one list of markers instead of list of lists
          const sorted = [...route.stops].sort((a, b) => a.sequence - b.sequence); 
          return sorted.map((stop) => (
            <AdvancedMarker
              key={stop.id}
              position={{ lat: stop.lat, lng: stop.lng }}
              title={stop.address}
            />
          ));
        })}
      </Map>
    </APIProvider>
  );
}
