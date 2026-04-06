// Map component for the Results page: Google Map, route polylines, and delivery stops.
// Uses @react-google-maps/api with Advanced Markers
"use client";

import { useCallback, useEffect, useRef, useState, Fragment } from "react";
import { LoadScriptNext, GoogleMap, Marker, Polyline } from "@react-google-maps/api";
import type { Route } from "../types";

const DAVIS_CENTER = { lat: 38.5449, lng: -121.7405 }; // Map center coordinates for Davis,CA (Google Maps needs as an initial center to position the initial view of the map)
const POLYLINE_COLOR = "#2563eb"; // Blue path per route (single mock route)

type PendingPinMove = { // type for pending pin move data
  routeId: string;
  stopId: string;
  lat: number;
  lng: number;
};

type MapComponentProps = {
  routes: Route[];
  isEditMode: boolean; // defining the props that map component receives from parent (page.tsx)
  pendingPinMove: PendingPinMove | null;
  onPendingPinMove: (routeId: string, stopId: string, lat: number, lng: number) => void;
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
      markersRef.current.forEach((m: google.maps.marker.AdvancedMarkerElement) => {
        m.map = null;
      });
      markersRef.current = [];
    };
  }, [map, routes]);

  return null;
}

export default function MapComponent({ // Receiving props (routes, isEditMode, pendingPinMove, onPendingPinMove) from parent (page.tsx)
  routes,
  isEditMode,
  pendingPinMove,
  onPendingPinMove,
}: MapComponentProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""; // API key for Google Maps API
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined; // mapId is the ID of the map instance, Advanced Markers needs a map id
  const [map, setMap] = useState<google.maps.Map | null>(null); // Creating a state variable to hold the map instance, initially null, but when Google calls the onMapLoad function, we'll call setMap(mapInstance) to save it

  const onMapLoad = useCallback( // onMapLoad is called when maps finished loading and gives us the map instance
    (mapInstance: google.maps.Map) => {
      setMap(mapInstance); // saving map instance in state so AdvancedMarkers can use it
      if (routes.length === 0) return;
      const bounds = new google.maps.LatLngBounds(); // Create an empty box (LatLngBounds), then for each stop in every route, we extend that box to include the stop's lat/lng coords
      routes.forEach((route) => {
        route.stops.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
      });
      mapInstance.fitBounds(bounds, 48);
    },
    [routes]
  );

  const onUnmount = useCallback(() => setMap(null), []);

  // When the browser window is resized, tell the map to redraw so it fills the new container size
  useEffect(() => {
    if (!map || typeof google === "undefined") return;
    const handleResize = () => {
      google.maps.event.trigger(map, "resize");
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [map]);

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
    <div className="w-full h-full rounded-lg">
      <LoadScriptNext // small component that loads google maps script, then renders map components inside it
        googleMapsApiKey={apiKey} // script needs api key
        mapIds={mapId ? [mapId] : undefined} // advanced markers needs map id
        loadingElement={<div className="min-h-[70vh] bg-zinc-100 animate-pulse rounded-lg" />}
      >
        <GoogleMap // component that draws the map
          mapContainerStyle={{ width: "100%", height: "100%" }}
          options={mapOptions}
          onLoad={onMapLoad} // when maps finished loading, google calls this and passes the map instance
          onUnmount={onUnmount}
        >
          {mapId && <AdvancedMarkers map={map} routes={routes} />}
          {routes.map((route) => { // For each route, we copy the stops array and sort them by sequence (visit order)
            const sorted = [...route.stops].sort((a, b) => a.sequence - b.sequence);
            const path = sorted.map((s) => { // And then for each stop in the sorted list, if this stop is the one that we dragged but haven't saved yet (from pendingPinMove) then use the new spot for that stop, otherwise use the original lat/lng coordinates
              if (
                pendingPinMove?.routeId === route.vehicleId &&
                pendingPinMove.stopId === s.id
              ) {
                return { lat: pendingPinMove.lat, lng: pendingPinMove.lng };
              }
              return { lat: s.lat, lng: s.lng };
            });
            return (
              <Fragment key={route.vehicleId}>
                <Polyline
                  path={path}
                  options={{
                    strokeColor: POLYLINE_COLOR,
                    strokeWeight: 5,
                    strokeOpacity: 0.9,
                  }}
                />
                {!mapId && // Fallback pins for when mapID isn't set. This renders pins using the original <Marker> for each stop instead of <AdvancedMarker>
                  sorted.map((stop) => {
                    const atPending = // Checks if the current stop is the one that we dragged but haven't saved yet (from pendingPinMove)
                      pendingPinMove?.routeId === route.vehicleId &&
                      pendingPinMove.stopId === stop.id;
                    const position = atPending // position uses the new lat/lng coordinates if the stop is the one that we dragged but haven't saved yet, otherwise uses the original lat/lng coordinates
                      ? { lat: pendingPinMove.lat, lng: pendingPinMove.lng }
                      : { lat: stop.lat, lng: stop.lng };
                    return (
                      <Marker
                        key={stop.id}
                        position={position}
                        title={stop.address}
                        draggable={isEditMode}
                        onDragEnd={(e) => { // onDragEnd calls onPendingPinMove to update the temporary data in pendingPinMove state, not routes until user saves
                          const latLng = e.latLng;
                          if (!latLng) return;
                          onPendingPinMove(
                            route.vehicleId,
                            stop.id,
                            latLng.lat(),
                            latLng.lng()
                          );
                        }}
                      />
                    );
                  })}
              </Fragment>
            );
          })}
        </GoogleMap>
      </LoadScriptNext>
    </div>
  );
}
