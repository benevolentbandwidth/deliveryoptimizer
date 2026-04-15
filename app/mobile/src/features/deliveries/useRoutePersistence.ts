import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import {
  createPersistedRouteState,
  parsePersistedRouteState,
} from './importSession';
import type { DriverRoute } from './types';

const ROUTE_STORAGE_KEY = 'driver-assist.active-route.v1';
const MAX_ROUTE_AGE_MS = 24 * 60 * 60 * 1000;

type RouteSetter = SetStateAction<DriverRoute | null>;

export function useRoutePersistence() {
  const [route, setRouteState] = useState<DriverRoute | null>(null);
  const [isRestored, setIsRestored] = useState(false);

  useEffect(() => {
    setRouteState(loadPersistedRoute());
    setIsRestored(true);
  }, []);

  useEffect(() => {
    if (!isRestored) {
      return;
    }

    persistRoute(route);
  }, [isRestored, route]);

  const clearRoute = () => {
    clearPersistedRoute();
    setRouteState(null);
  };

  return {
    route,
    setRoute: setRouteState as Dispatch<RouteSetter>,
    clearRoute,
    isRestored,
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
    const persistedRoute = parsePersistedRouteState(parsedValue);
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

  const payload = JSON.stringify(createPersistedRouteState(route));

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
