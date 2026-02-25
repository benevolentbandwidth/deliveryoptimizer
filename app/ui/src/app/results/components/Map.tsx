// Map component for the Results page: Google Map, route polylines, and delivery stops.
// Uses @react-google-maps/api with Advanced Markers
"use client";

import { useCallback, useEffect, useRef, useState, Fragment } from "react";
import { LoadScriptNext, GoogleMap, Polyline } from "@react-google-maps/api";
import type { Route } from "../types";

const DAVIS_CENTER = { lat: 38.5449, lng: -121.7405 }; // Map center coordinates for Davis,CA (Google Maps needs as an initial center to position the initial view of the map)
const POLYLINE_COLOR = "#2563eb"; // Blue path per route (single mock route)

type MapComponentProps = {
  routes: Route[];
};

// Created a helper component (AdvancedMarkers), which creates the pins and attaches them to the map (it receives two things: google map instance and list of routes)
function AdvancedMarkers({ map, routes }: { map: google.maps.Map | null; routes: Route[] }) {
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]); // markersRef is a ref that holds an array of the pin objects we'll create

  useEffect(() => { 
    if (!map || routes.length === 0) return;

    let cancelled = false;
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];

    (async () => {
      try {
        const { AdvancedMarkerElement } = (await google.maps.importLibrary( // We import the library that contains the Advanced Maker Element (class, where each pin on the map is an instance of that class)
          "marker"
        )) as google.maps.MarkerLibrary;

        if (cancelled) return; // If cancelled is true, meaning the component might've unmounted, we stop and don't create any pins 

        routes.forEach((route) => { // For each route, we take its stops and sort them by sequence (visit order). We copy the array first so we don't mutate the original array
          const sorted = [...route.stops].sort((a, b) => a.sequence - b.sequence);
          sorted.forEach((stop) => {
            const m = new AdvancedMarkerElement({ // We create a new instance of the Advanced Marker Element class for each stop, with the map, position, and title
              map,
              position: { lat: stop.lat, lng: stop.lng },
              title: stop.address,
            });
            markers.push(m); // We save the array of pins we created into markersRef
          });
        });
        markersRef.current = markers;
      } catch {
        // In the event of library failed to load or no mapID, then we catch and the map just won't show any pins
      }
    })();

    return () => { // Cleanup function to clean up the pins when the component unmounts
      cancelled = true;
      markersRef.current.forEach((m) => { // For each pin, we set the map to null so it's removed from the map
        m.map = null;
      });
      markersRef.current = [];
    };
  }, [map, routes]);

  return null;
}

export default function MapComponent({ routes }: MapComponentProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""; // API key for Google Maps API
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined; // mapId is the ID of the map instance, Advanced Markers needs a map id
  const [map, setMap] = useState<google.maps.Map | null>(null); // Creating a state variable to hold the map instance, initially null, but when Google calls the onMapLoad function, we'll call setMap(mapInstance) to save it

  const onMapLoad = useCallback( // onMapLoad is called when maps finished loading and gives us the map instance
    (mapInstance: google.maps.Map) => {
      setMap(mapInstance); // saving map instance in state so AdvancedMarkers can use it
      if (routes.length === 0) return;
      const bounds = new google.maps.LatLngBounds(); // Create an empty box (LatLngBounds), then for each stop in every rote, we extend that box to include the stop's lat/lng coords
      routes.forEach((route) => {
        route.stops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng })); 
      });
      mapInstance.fitBounds(bounds, 48);
    },
    [routes]
  );

  const onUnmount = useCallback(() => setMap(null), []);

  if (!apiKey) {
    return (
      <div className="min-h-[60vh] grid place-items-center bg-zinc-100 text-zinc-600">
        Missing NEXT_PUBLIC_GOOGLE_MAPS_KEY
      </div>
    );
  }

  const mapOptions: google.maps.MapOptions = { // mapOptions is the options for the map, including the center and zoom level
    center: DAVIS_CENTER,
    zoom: 11,
    ...(mapId ? { mapId } : {}),
  };

  return (
    <div className="w-full h-full min-h-[70vh] rounded-lg">
      <LoadScriptNext // small component that loads google maps script, then renders map components inside it
        googleMapsApiKey={apiKey} // script needs api key
        mapIds={mapId ? [mapId] : undefined} // advanced markers needs map id
        loadingElement={<div className="min-h-[70vh] bg-zinc-100 animate-pulse rounded-lg" />}
      >
        <GoogleMap // component that draws the map
          mapContainerStyle={{ width: "100%", height: "100%", minHeight: "70vh" }}
          options={mapOptions}
          onLoad={onMapLoad} // when maps finished loading, google calls this and passes the map instance
          onUnmount={onUnmount} 
        >
          {mapId && <AdvancedMarkers map={map} routes={routes} />}
          {routes.map((route) => { // For each route, we sort the stops by sequence (visit order), then map the stops to an array of lat/lng objects
            const sorted = [...route.stops].sort((a, b) => a.sequence - b.sequence);
            const path = sorted.map((s) => ({ lat: s.lat, lng: s.lng }));
            return ( // We draw a polyline for each route, with the stops in the order they're visited
              <Fragment key={route.vehicleId}>
                <Polyline
                  path={path}
                  options={{
                    strokeColor: POLYLINE_COLOR,
                    strokeWeight: 5,
                    strokeOpacity: 0.9,
                  }}
                />
              </Fragment>
            );
          })}
        </GoogleMap>
      </LoadScriptNext>
    </div>
  );
}
