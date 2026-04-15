import { Platform, Share } from 'react-native';

import type { DriverRoute } from './types';

export type EndOfShiftSummary = {
  version: 1;
  endedAt: string;
  endReason?: string;
  route: DriverRoute;
  summary: {
    totalStops: number;
    completedStops: number;
    failedStops: number;
    pendingStops: number;
  };
};

export async function exportEndOfShiftSummary(
  route: DriverRoute,
  endReason: string
): Promise<void> {
  const summary = createEndOfShiftSummary(route, endReason);
  const json = JSON.stringify(summary, null, 2);

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    downloadJsonFile(json, buildFileName(summary.endedAt));
    return;
  }

  await Share.share({
    title: 'End of Shift Summary',
    message: json,
  });
}

function createEndOfShiftSummary(route: DriverRoute, endReason: string): EndOfShiftSummary {
  const completedStops = route.stops.filter((stop) => stop.status === 'completed').length;
  const failedStops = route.stops.filter((stop) => stop.status === 'failed').length;
  const pendingStops = route.stops.filter((stop) => stop.status === 'pending').length;
  const trimmedReason = endReason.trim();

  return {
    version: 1,
    endedAt: new Date().toISOString(),
    endReason: trimmedReason || undefined,
    route,
    summary: {
      totalStops: route.stops.length,
      completedStops,
      failedStops,
      pendingStops,
    },
  };
}

function downloadJsonFile(json: string, fileName: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildFileName(timestamp: string) {
  const safeTimestamp = timestamp.replace(/[:.]/g, '-');
  return `end_of_shift_${safeTimestamp}.json`;
}
