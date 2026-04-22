import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const restoreRoute = async () => {
      const persistedRoute = await loadPersistedRoute(setStorageAvailable);

      if (!isMounted) {
        return;
      }

      setRouteState(persistedRoute);
      setIsRestored(true);
    };

    void restoreRoute();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isRestored) {
      return;
    }

    void persistRoute(route, setStorageAvailable);
  }, [isRestored, route]);

  const clearRoute = () => {
    void clearPersistedRoute(setStorageAvailable);
    setRouteState(null);
  };

  return {
    route,
    setRoute: setRouteState as Dispatch<RouteSetter>,
    clearRoute,
    isRestored,
    storageAvailable,
  };
}

async function loadPersistedRoute(
  setStorageAvailable: Dispatch<SetStateAction<boolean>>
): Promise<DriverRoute | null> {
  let savedValue: string | null;

  try {
    savedValue = await AsyncStorage.getItem(ROUTE_STORAGE_KEY);
    setStorageAvailable(true);
  } catch {
    setStorageAvailable(false);
    return null;
  }

  if (!savedValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(savedValue);
    const persistedRoute = parsePersistedRouteState(parsedValue);
    const savedAt = new Date(persistedRoute.savedAt).getTime();

    if (Number.isNaN(savedAt) || Date.now() - savedAt > MAX_ROUTE_AGE_MS) {
      await clearPersistedRoute(setStorageAvailable);
      return null;
    }

    return persistedRoute.route;
  } catch {
    await clearPersistedRoute(setStorageAvailable);
    return null;
  }
}

async function persistRoute(
  nextRoute: DriverRoute | null,
  setStorageAvailable: Dispatch<SetStateAction<boolean>>
) {
  try {
    if (!nextRoute) {
      await clearPersistedRoute(setStorageAvailable);
      return;
    }

    const payload = JSON.stringify(createPersistedRouteState(nextRoute));
    await AsyncStorage.setItem(ROUTE_STORAGE_KEY, payload);
    setStorageAvailable(true);
  } catch {
    setStorageAvailable(false);
  }
}

async function clearPersistedRoute(
  setStorageAvailable: Dispatch<SetStateAction<boolean>>
) {
  try {
    await AsyncStorage.removeItem(ROUTE_STORAGE_KEY);
    setStorageAvailable(true);
  } catch {
    setStorageAvailable(false);
  }
}
