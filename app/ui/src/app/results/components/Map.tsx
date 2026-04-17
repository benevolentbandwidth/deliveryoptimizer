// Map component for the Results page: Google Map, route polylines, and delivery stops.
// Uses @react-google-maps/api with Advanced Markers
"use client";

import { useCallback, useEffect, useRef, useState, Fragment } from "react";
import { LoadScriptNext, GoogleMap, Marker, Polyline } from "@react-google-maps/api";
import type { Route } from "../types";

const DAVIS_CENTER = { lat: 38.5449, lng: -121.7405 }; // Google still wants an initial center before fitBounds runs
const POLYLINE_COLOR = "#2563eb";

type MapComponentProps = {
  routes: Route[];
  isEditMode: boolean;
  onUpdateStopCoordinates?: ( // notice this prop is optional, meaning the parent is only notified when a pin finished being dragged if this function (onUpdateStopCoordinates) is passed, if not, the onDragEnd handler does nothing (no parent update)
    routeId: string,
    stopId: string,
    lat: number,
    lng: number
  ) => void;
};

function AdvancedMarkers({ map, routes }: { map: google.maps.Map | null; routes: Route[] }) {
  // TODO: draggable not yet implemented for AdvancedMarkers (see #84)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  useEffect(() => {
    if (!map || routes.length === 0) return;

    let cancelled = false;
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];

    (async () => {
      try {
        const { AdvancedMarkerElement } = (await google.maps.importLibrary("marker")) as google.maps.MarkerLibrary;

        if (cancelled) return;

        routes.forEach((route) => {
          const sorted = [...route.stops].sort((a, b) => a.sequence - b.sequence);
          sorted.forEach((stop) => {
            const m = new AdvancedMarkerElement({
              map,
              position: { lat: stop.lat, lng: stop.lng },
              title: stop.address,
            });
            markers.push(m);
          });
        });
        markersRef.current = markers;
      } catch {
        // Library / mapId problems, we just won't show pins
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m: google.maps.marker.AdvancedMarkerElement) => {
        m.map = null;
      });
      markersRef.current = [];
    };
  }, [map, routes]);

  return null;
}

export default function MapComponent({
  routes,
  isEditMode,
  onUpdateStopCoordinates,
}: MapComponentProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined; // AdvancedMarkerElement needs a mapId
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

  // Map doesn't always follow container size, so we trigger a redraw after window resize
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

  const mapOptions: google.maps.MapOptions = {
    center: DAVIS_CENTER,
    zoom: 11,
    ...(mapId ? { mapId } : {}),
  };

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
          {mapId && <AdvancedMarkers map={map} routes={routes} />}
          {routes.map((route) => {
            const sorted = [...route.stops].sort((a, b) => a.sequence - b.sequence);
            const path = sorted.map((s) => ({ lat: s.lat, lng: s.lng }));
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
                {/* Classic Marker fallback when mapId is not set (e.g. dev without NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID) */}
                {!mapId &&
                  sorted.map((stop) => (
                    <Marker
                      key={stop.id}
                      position={{ lat: stop.lat, lng: stop.lng }}
                      title={stop.address}
                      draggable={isEditMode}
                      onDragEnd={(e) => {
                        const latLng = e.latLng;
                        if (!latLng) return;
                        onUpdateStopCoordinates?.(
                          route.vehicleId,
                          stop.id,
                          latLng.lat(),
                          latLng.lng()
                        );
                      }}
                    />
                  ))}
              </Fragment>
            );
          })}
        </GoogleMap>
      </LoadScriptNext>
    </div>
  );
}
