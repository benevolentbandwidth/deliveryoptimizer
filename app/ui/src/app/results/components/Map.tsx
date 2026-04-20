// Map component for the Results page: Google Map, route polylines, and delivery stops.
// Uses @react-google-maps/api with Advanced Markers
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { LoadScriptNext, GoogleMap, Marker, useGoogleMap } from "@react-google-maps/api";
import type { PendingPinMove, Route } from "../types";

const DAVIS_CENTER = { lat: 38.5449, lng: -121.7405 }; // Map center coordinates for Davis,CA (Google Maps needs as an initial center to position the initial view of the map)
const POLYLINE_COLOR = "#2563eb"; // Blue path per route (single mock route)

// Made a one shared style object for the polylines (color, weight, opacity) so we can reuse it when we call new google.maps.polyline() so a new style object isn't created each render
const ROUTE_POLYLINE_OPTIONS: google.maps.PolylineOptions = {
  strokeColor: POLYLINE_COLOR,
  strokeWeight: 5,
  strokeOpacity: 0.9,
};

// Now that <Polyline> is no longer used, we created a function (buildRoutePath) that reapplies some of the same logic from the old <Polyline component
function buildRoutePath( // This function builds the lists of points for line to draw by sorting stops by sequence (visit order) and checking each stop in order if it's the one with an unsaved drag draft (if so use that draft coords)
  route: Route,
  pendingPinMove: PendingPinMove | null
): google.maps.LatLngLiteral[] {
  const sorted = [...route.stops].sort((a, b) => a.sequence - b.sequence);
  return sorted.map((s) => {
    if (
      pendingPinMove?.vehicleId === route.vehicleId &&
      pendingPinMove.stopId === s.id
    ) {
      return { lat: pendingPinMove.lat, lng: pendingPinMove.lng };
    }
    return { lat: s.lat, lng: s.lng }; // result is a array of coords for the polyline to follow
  });
}

// The following function replaced the old <Polyline> component, here we perform the same task of drawing the polylines, but we talk to the Google maps objects directly (javascript api in browser: new google.maps.Polyline(), setMap(null))
// setMap(null) removes the previous polyline from the map when pendingPinMove changes, routes change (after save), or the map unmounts
// Build path with buildRoutePath and remember those objects in polylineRef so we can clear them next time
function RoutePolylinesOverlay({
  routes,
  pendingPinMove,
}: {
  routes: Route[];
  pendingPinMove: PendingPinMove | null;
}) {
  const map = useGoogleMap();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map) return;

    polylinesRef.current.forEach((p) => {
      p.setMap(null);
    });
    polylinesRef.current = [];

    routes.forEach((route) => {
      const path = buildRoutePath(route, pendingPinMove);
      if (path.length < 2) return;
      const poly = new google.maps.Polyline({
        map,
        path,
        ...ROUTE_POLYLINE_OPTIONS,
      });
      polylinesRef.current.push(poly);
    });

    return () => {
      polylinesRef.current.forEach((p) => {
        p.setMap(null);
      });
      polylinesRef.current = [];
    };
  }, [map, routes, pendingPinMove]);

  return null;
}

function latLngFromMarkerPosition( // after a drag, google maps can provide the new lat/lng object in either LatLng (.lat(), .lng()) or plain object (.lat, .lng)
  p: google.maps.marker.AdvancedMarkerElement["position"] // this function looks at the what type object we have and turns into the sample format of {lat: number, lng: number}, and if it doesn't understand the value still, it returns null again
): { lat: number; lng: number } | null {
  if (p == null) return null;
  if (typeof (p as google.maps.LatLng).lat === "function") {
    const ll = p as google.maps.LatLng;
    return { lat: ll.lat(), lng: ll.lng() };
  }
  const lit = p as google.maps.LatLngLiteral;
  if (typeof lit.lat === "number" && typeof lit.lng === "number") {
    return { lat: lit.lat, lng: lit.lng };
  }
  return null;
}

type MapComponentProps = {
  routes: Route[];
  isEditMode: boolean; // defining the props that map component receives from parent (page.tsx)
  pendingPinMove?: PendingPinMove | null;
  onPendingPinMove?: (vehicleId: string, stopId: string, lat: number, lng: number) => void;
  onUpdateStopCoordinates?: (routeId: string, stopId: string, lat: number, lng: number) => void;
};

type AdvancedMarkersProps = { // Before AdvancedMarkers only needed map and routes, but now it needs five props, so we pulled the shape out instead of writing inline in the function
  map: google.maps.Map | null;
  routes: Route[];
  isEditMode: boolean;
  pendingPinMove: PendingPinMove | null;
  onPendingPinMove: (vehicleId: string, stopId: string, lat: number, lng: number) => void;
};

function AdvancedMarkers({
  map,
  routes,
  isEditMode,
  pendingPinMove,
  onPendingPinMove,
}: AdvancedMarkersProps) {
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

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
            const atPending = // creating a variable to check if the current stop is the one we dragged but unsaved yet
              pendingPinMove != null &&
              pendingPinMove.vehicleId === route.vehicleId &&
              pendingPinMove.stopId === stop.id;
            const position = atPending // creating a variable to determine the position of the pin, if atPending then use draft coords from pendingPinMove (unsaved dragged), otherwise use saved coords from stop obj
              ? { lat: pendingPinMove.lat, lng: pendingPinMove.lng }
              : { lat: stop.lat, lng: stop.lng };

            const m = new AdvancedMarkerElement({
              map,
              position,
              title: stop.address,
              gmpDraggable: isEditMode,
            });

            m.addListener("dragend", () => { //
              const ll = latLngFromMarkerPosition(m.position); // read where pin ended
              if (!ll) return;
              onPendingPinMove(route.vehicleId, stop.id, ll.lat, ll.lng); // call onPendingPinMove so page updates draft only (advanced marker version of onDragEnd in <Marker>)
            });

            markers.push(m);
          });
        });

        if (cancelled) { // Setting cancelled to true in cleanup since react will re-run the effect while component is mounted, as it may create duplicate pins or stale drag handlers from an older effect
          markers.forEach((m) => {
            google.maps.event.clearInstanceListeners(m);
            m.map = null;
          });
          return;
        }

        markersRef.current = markers;
      } catch {
        // In the event of library failed to load or no mapID, then we catch and the map just won't show any pins
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => {
        google.maps.event.clearInstanceListeners(m);
        m.map = null;
      });
      markersRef.current = [];
    };
  }, [map, routes, pendingPinMove, isEditMode, onPendingPinMove]);

  return null;
}

export default function MapComponent({ // Receiving props (routes, isEditMode, pendingPinMove, onPendingPinMove) from parent (page.tsx)
  routes,
  isEditMode,
  pendingPinMove = null,
  onPendingPinMove,
  onUpdateStopCoordinates,
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
  const notifyPinMove = useCallback(
    (vehicleId: string, stopId: string, lat: number, lng: number) => {
      if (onPendingPinMove) {
        onPendingPinMove(vehicleId, stopId, lat, lng);
        return;
      }
      onUpdateStopCoordinates?.(vehicleId, stopId, lat, lng);
    },
    [onPendingPinMove, onUpdateStopCoordinates]
  );

  // When the browser window is resized, tell the map to redraw so it fills the new container size
  useEffect(() => {
    if (!map || typeof google === "undefined") return;
    const handleResize = () => {
      google.maps.event.trigger(map, "resize");
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [map]);

  const mapOptions = useMemo( // mapOptions is the options for the map, including center and zoom level. useMemo builds that one object once and reuse it until mapId changes
    (): google.maps.MapOptions => ({
      center: DAVIS_CENTER,
      zoom: 11,
      ...(mapId ? { mapId } : {}),
    }),
    [mapId]
  );

  if (!apiKey) {
    return (
      <div className="min-h-[60vh] grid place-items-center bg-zinc-100 text-zinc-600">
        Missing NEXT_PUBLIC_GOOGLE_MAPS_KEY
      </div>
    );
  }

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
          <RoutePolylinesOverlay routes={routes} pendingPinMove={pendingPinMove} />
          {mapId && (
            <AdvancedMarkers
              map={map}
              routes={routes}
              isEditMode={isEditMode}
              pendingPinMove={pendingPinMove}
              onPendingPinMove={notifyPinMove}
            />
          )}
          {!mapId &&
            routes.map((route) => {
              const sorted = [...route.stops].sort((a, b) => a.sequence - b.sequence);
              return (
                <Fragment key={route.vehicleId}>
                  {sorted.map((stop) => {
                    const atPending =
                      pendingPinMove != null &&
                      pendingPinMove.vehicleId === route.vehicleId &&
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
                          notifyPinMove(
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
