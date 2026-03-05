// Map component for the Results page that renders the Google Map, draws the routes, and shows the delivery stops as markers
"use client";

import { useCallback, Fragment } from "react";
import { LoadScriptNext, GoogleMap, Marker, Polyline } from "@react-google-maps/api"; // Loading the Google Maps API
import type { Route } from "../types";

const DAVIS_CENTER = { lat: 38.5449, lng: -121.7405 }; // Map center coordinates for Davis, CA (Google Maps needs an initial center to position the initial view of the map)
const POLYLINE_COLOR = "#2563eb"; // Blue path per issue spec (single mock route)

type MapComponentProps = {
  routes: Route[];
};

export default function MapComponent({ routes }: MapComponentProps) { // Passing the routes data to the Map component
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

  const onMapLoad = useCallback( // When the map has finished loading, we build the bounds of the map to fit all the routes and stops
    (map: google.maps.Map) => {
      const bounds = new google.maps.LatLngBounds();
      routes.forEach((route) => {
        route.stops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
      });
      map.fitBounds(bounds, 48); // 48 pixels of padding around the edges
    },
    [routes]
  );

  if (!apiKey) { // If the API key is not found, we return a message to the user
    return (
      <div className="min-h-[60vh] grid place-items-center bg-zinc-100 text-zinc-600">
        Missing NEXT_PUBLIC_GOOGLE_MAPS_KEY
      </div>
    );
  }

  return ( // Loading the Google Maps API, center and zoom the initial view (GoogleMap) and adjust the view once the map is ready (onLoad)
    <LoadScriptNext googleMapsApiKey={apiKey}>
      <GoogleMap
        center={DAVIS_CENTER}
        zoom={11}
        onLoad={onMapLoad}
        mapContainerStyle={{ width: "100%", height: "100%", minHeight: "70vh" }}
        mapContainerClassName="w-full min-h-[70vh] rounded-lg"
      >
        {routes.map((route) => { // Rendering each route
          const sortedStops = [...route.stops].sort((a, b) => a.sequence - b.sequence); // Sorting the stops based on the sequence
          const path = sortedStops.map((s) => ({ lat: s.lat, lng: s.lng }));

          return ( // Using Fragment to wrap the Polyline and markers (and holds the key for the route), so they stay attached to map, whereas with div before treated as a separate DOM element 
            <Fragment key={route.vehicleId}>
              <Polyline // Drawing the route path connecting stops in order (blue line)
                path={path}
                options={{
                  strokeColor: POLYLINE_COLOR,
                  strokeWeight: 5,
                  strokeOpacity: 0.9,
                }}
              />
              {sortedStops.map((stop) => (
                <Marker // Drawing one marker for each stop
                  key={stop.id}
                  position={{ lat: stop.lat, lng: stop.lng }}
                  title={stop.address}
                />
              ))}
            </Fragment>
          );
        })}
      </GoogleMap>
    </LoadScriptNext>
  );
}
