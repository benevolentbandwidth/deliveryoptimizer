// Map component for the Results page: Google Map, route polylines, and delivery stops.
// Uses @react-google-maps/api with Advanced Markers
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { LoadScriptNext, GoogleMap, Marker, useGoogleMap } from "@react-google-maps/api";
import type { PendingPinMove, Route } from "../types";

const DAVIS_CENTER = { lat: 38.5449, lng: -121.7405 };
const POLYLINE_COLOR = "#2563eb";

const ROUTE_POLYLINE_OPTIONS: google.maps.PolylineOptions = {
  strokeColor: POLYLINE_COLOR,
  strokeWeight: 5,
  strokeOpacity: 0.9,
};

function buildRoutePath(
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
    return { lat: s.lat, lng: s.lng };
  });
}

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

function latLngFromMarkerPosition(
  p: google.maps.marker.AdvancedMarkerElement["position"]
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
  isEditMode: boolean;
  pendingPinMove?: PendingPinMove | null;
  onPendingPinMove?: (vehicleId: string, stopId: string, lat: number, lng: number) => void;
  onUpdateStopCoordinates?: (routeId: string, stopId: string, lat: number, lng: number) => void;
};

type AdvancedMarkersProps = {
  map: google.maps.Map | null;
  routes: Route[];
  isEditMode: boolean;
  pendingPinMove: PendingPinMove | null;
  onPendingPinMove: (vehicleId: string, stopId: string, lat: number, lng: number) => void;
};

function stopKey(vehicleId: string, stopId: string): string {
  return `${vehicleId}:${stopId}`;
}

function AdvancedMarkers({
  map,
  routes,
  isEditMode,
  pendingPinMove,
  onPendingPinMove,
}: AdvancedMarkersProps) {
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const markerByStopKeyRef = useRef<Record<string, google.maps.marker.AdvancedMarkerElement>>({});
  const pendingPinMoveRef = useRef(pendingPinMove);

  useEffect(() => {
    pendingPinMoveRef.current = pendingPinMove;
  }, [pendingPinMove]);

  // Rebuild markers only when map, routes, edit mode, or handler identity change — not on every draft coord update.
  useEffect(() => {
    if (!map || routes.length === 0) return;

    let cancelled = false;
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];
    markerByStopKeyRef.current = {};

    (async () => {
      try {
        const { AdvancedMarkerElement } = (await google.maps.importLibrary("marker")) as google.maps.MarkerLibrary;

        if (cancelled) return;

        routes.forEach((route) => {
          const sorted = [...route.stops].sort((a, b) => a.sequence - b.sequence);
          sorted.forEach((stop) => {
            const position = { lat: stop.lat, lng: stop.lng };

            const m = new AdvancedMarkerElement({
              map,
              position,
              title: stop.address,
              gmpDraggable: isEditMode,
            });

            m.addListener("dragend", () => {
              const ll = latLngFromMarkerPosition(m.position);
              if (!ll) return;
              onPendingPinMove(route.vehicleId, stop.id, ll.lat, ll.lng);
            });

            markers.push(m);
            markerByStopKeyRef.current[stopKey(route.vehicleId, stop.id)] = m;
          });
        });

        if (cancelled) {
          markers.forEach((m) => {
            google.maps.event.clearInstanceListeners(m);
            m.map = null;
          });
          return;
        }

        markersRef.current = markers;

        const p = pendingPinMoveRef.current;
        if (p) {
          const m = markerByStopKeyRef.current[stopKey(p.vehicleId, p.stopId)];
          if (m) m.position = { lat: p.lat, lng: p.lng };
        }
      } catch {
        // Advanced markers need mapId; missing library leaves map without pins.
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => {
        google.maps.event.clearInstanceListeners(m);
        m.map = null;
      });
      markersRef.current = [];
      markerByStopKeyRef.current = {};
    };
  }, [map, routes, isEditMode, onPendingPinMove]);

  // Move one pin for drafts, or snap all pins back to `routes` when draft clears — avoids rebuilding every marker on each drag.
  useEffect(() => {
    if (!map) return;
    if (pendingPinMove) {
      const m = markerByStopKeyRef.current[stopKey(pendingPinMove.vehicleId, pendingPinMove.stopId)];
      if (m) m.position = { lat: pendingPinMove.lat, lng: pendingPinMove.lng };
      return;
    }
    routes.forEach((route) => {
      route.stops.forEach((stop) => {
        const m = markerByStopKeyRef.current[stopKey(route.vehicleId, stop.id)];
        if (m) m.position = { lat: stop.lat, lng: stop.lng };
      });
    });
  }, [map, pendingPinMove, routes]);

  return null;
}

export default function MapComponent({
  routes,
  isEditMode,
  pendingPinMove = null,
  onPendingPinMove,
  onUpdateStopCoordinates,
}: MapComponentProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined;
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onMapLoad = useCallback(
    (mapInstance: google.maps.Map) => {
      setMap(mapInstance);
      if (routes.length === 0) return;
      const bounds = new google.maps.LatLngBounds();
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

  useEffect(() => {
    if (!map || typeof google === "undefined") return;
    const handleResize = () => {
      google.maps.event.trigger(map, "resize");
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [map]);

  const mapOptions = useMemo(
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
      <LoadScriptNext
        googleMapsApiKey={apiKey}
        mapIds={mapId ? [mapId] : undefined}
        loadingElement={<div className="min-h-[70vh] bg-zinc-100 animate-pulse rounded-lg" />}
      >
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          options={mapOptions}
          onLoad={onMapLoad}
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
                    const position = atPending
                      ? { lat: pendingPinMove.lat, lng: pendingPinMove.lng }
                      : { lat: stop.lat, lng: stop.lng };
                    return (
                      <Marker
                        key={stop.id}
                        position={position}
                        title={stop.address}
                        draggable={isEditMode}
                        onDragEnd={(e) => {
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
