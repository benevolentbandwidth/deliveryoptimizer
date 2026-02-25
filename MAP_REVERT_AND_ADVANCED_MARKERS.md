# Map revert + Advanced Markers (what we did and why)

## 1. What we reverted

- **From:** `@vis.gl/react-google-maps` (newer library) with `<Map>`, `<AdvancedMarker>`, `APIProvider`, `useMap()` for polylines.
- **To:** `@react-google-maps/api` (older library) with `LoadScriptNext`, `<GoogleMap>`, `<Polyline>`, and **imperative** Advanced Markers.

**Why:** The map was rendering **black** with vis.gl in this environment. We tried: layout wrapper, no mapId + legacy Marker, ad-blocker fix, raster rendering, and a real Cloud Console Map ID. None fixed it. Reverting to the old library made the map display again.

---

## 2. Why we still use Advanced Markers (and how)

- **Reviewer ask:** Use the **non-deprecated** marker API. The classic `Marker` is deprecated in favor of **Advanced Markers**.
- **Ideal:** vis.gl exposes `<AdvancedMarker>` as a component, but we had to leave vis.gl because of the black map.
- **Reality:** In `@react-google-maps/api` there is **no** `<AdvancedMarker>` component—only the legacy `<Marker>`. So we couldn’t “just use a component”; we had to use the **raw Google API** for Advanced Markers.

**What we did:**

- When **`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`** is set (e.g. from Cloud Console):
  - We pass `mapId` into the map options and load the marker library (`mapIds` on LoadScriptNext, and `importLibrary("marker")`).
  - A small **`AdvancedMarkers`** helper (in `Map.tsx`) runs in `useEffect`: it gets the map instance, calls `google.maps.importLibrary("marker")`, then creates one **`AdvancedMarkerElement`** per stop and assigns `map`, `position`, and `title`. Cleanup removes them from the map.
- So we **are** using Advanced Markers (non-deprecated API), but we **built them ourselves** with the imperative API instead of a library component.

**Fallback:** If `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` is not set, we still render the legacy `<Marker>` so the map keeps showing pins somewhere that doesn’t have a Map ID.

---

## 3. Summary in one sentence

We reverted the map to `@react-google-maps/api` so it stops rendering black; we still satisfy the reviewer by using **Advanced Markers** via the raw API (no `<AdvancedMarker>` component in this library, so we create `AdvancedMarkerElement`s in a small helper).

---

## 4. Files that changed in this revert

- **`ui/package.json`:** Dependency switched from `@vis.gl/react-google-maps` to `@react-google-maps/api`.
- **`ui/src/app/results/components/Map.tsx`:**  
  - Uses `LoadScriptNext`, `GoogleMap`, `Polyline` (and `Marker` only when no Map ID).  
  - Adds `AdvancedMarkers` component that, when `mapId` is set, creates `AdvancedMarkerElement`s in `useEffect` with `importLibrary("marker")`.  
  - Map options use `mapId` from `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` when set.
- **`ui/.env.local`:** Optional `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (e.g. your Cloud Console Map ID) so Advanced Markers are used.

No other app files (Sidebar, page, etc.) need to change for this revert.

---

## 5. Before vs Now (edit-mode-toggle Map.tsx)

**Before (your previous commit):** One component, `LoadScriptNext` → `GoogleMap` → for each route: `<Polyline>` + `<Marker>` for each stop. Markers were the **legacy** `<Marker>` from the library.

**Now:** Same overall shape, with two additions and one swap.

| Part | Before | Now |
|------|--------|-----|
| **Map / script** | `LoadScriptNext` + `GoogleMap` (center, zoom, onLoad, mapContainerStyle) | Same, plus: we can pass **mapId** (from env) and **mapIds** so the Advanced Markers library can load. We pass **options** (center, zoom, and mapId when set) and **onUnmount** to clear state. |
| **Polylines** | One `<Polyline>` per route, same path/options | **Same.** Still one `<Polyline>` per route with the same path and options. |
| **Markers** | One `<Marker>` per stop (legacy, deprecated) | **If mapId is set:** We don’t render `<Marker>`. We render `<AdvancedMarkers map={map} routes={routes} />`, which in a `useEffect` loads `importLibrary("marker")` and creates one `AdvancedMarkerElement` per stop (same positions and titles). **If mapId is not set:** We still render the same legacy `<Marker>` per stop so the map works without a Map ID. |
| **Map instance** | Only used inside `onMapLoad` for fitBounds | We store it in state (`setMap(mapInstance)`) so we can pass it to `<AdvancedMarkers>` for creating the Advanced Marker elements. |

**In short:**  
- **Same:** LoadScriptNext, GoogleMap, fitBounds, one Polyline per route, one pin per stop (same positions/titles).  
- **Different:** When you have a Map ID, the pins are created with the **Advanced Markers** API (our small helper) instead of the legacy `<Marker>` component; when you don’t have a Map ID, we still use `<Marker>` so nothing breaks.
