import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { z } from 'zod';

import type { DriverRoute } from './types';

const ROUTE_STORAGE_KEY = 'driver-assist.active-route.v1';
const MAX_ROUTE_AGE_MS = 24 * 60 * 60 * 1000;

const persistedStopSchema = z.object({
  id: z.string(),
  stopNumber: z.number(),
  address: z.string(),
  customerName: z.string(),
  phoneNumber: z.string().optional(),
  packageCount: z.number(),
  notes: z.string(),
  status: z.enum(['pending', 'completed', 'failed']),
  lat: z.number(),
  lng: z.number(),
  completedAt: z.string().optional(),
  failureReason: z.string().optional(),
});

const persistedRouteSchema = z.object({
  driverName: z.string(),
  routeLabel: z.string(),
  stops: z.array(persistedStopSchema),
});

const persistedRouteStateSchema = z.object({
  savedAt: z.string().datetime(),
  route: persistedRouteSchema,
});

type RouteSetter = SetStateAction<DriverRoute | null>;

export function useRoutePersistence() {
  const [route, setRouteState] = useState<DriverRoute | null>(() => loadPersistedRoute());

  useEffect(() => {
    persistRoute(route);
  }, [route]);

  const clearRoute = () => {
    clearPersistedRoute();
    setRouteState(null);
  };

  return {
    route,
    setRoute: setRouteState as Dispatch<RouteSetter>,
    clearRoute,
    storageAvailable: canUseLocalStorage(),
  };
}

function loadPersistedRoute(): DriverRoute | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  const savedValue = window.localStorage.getItem(ROUTE_STORAGE_KEY);
  if (!savedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(savedValue);
    const persistedRoute = persistedRouteStateSchema.parse(parsedValue);
    const savedAt = new Date(persistedRoute.savedAt).getTime();

    if (Number.isNaN(savedAt) || Date.now() - savedAt > MAX_ROUTE_AGE_MS) {
      clearPersistedRoute();
      return null;
    }

    return persistedRoute.route;
  } catch {
    clearPersistedRoute();
    return null;
  }
}

function persistRoute(route: DriverRoute | null) {
  if (!canUseLocalStorage()) {
    return;
  }

  if (!route) {
    clearPersistedRoute();
    return;
  }

  const payload = JSON.stringify({
    savedAt: new Date().toISOString(),
    route,
  });

  window.localStorage.setItem(ROUTE_STORAGE_KEY, payload);
}

function clearPersistedRoute() {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(ROUTE_STORAGE_KEY);
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
