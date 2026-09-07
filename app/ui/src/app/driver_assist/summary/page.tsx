"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { downloadRouteSummary } from "@/lib/driver-route/exportSummary";

import DriverFooter from "../components/DriverFooter";
import { readSavedRoute, ROUTE_STORE_EVENT, STORAGE_KEY } from "../storage";
import SummaryStatBlock from "./components/SummaryStatBlock";
import SummaryStopCard from "./components/SummaryStopCard";
import { summaryStyles as styles } from "./styles";

function subscribeToRouteStore(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const notify = () => onStoreChange();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener(ROUTE_STORE_EVENT, notify);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(ROUTE_STORE_EVENT, notify);
    window.removeEventListener("storage", handleStorage);
  };
}

function readEmptyRoute() {
  return null;
}

export default function DriverAssistSummaryPage() {
  const router = useRouter();
  const route = useSyncExternalStore(
    subscribeToRouteStore,
    readSavedRoute,
    readEmptyRoute,
  );
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    const savedRoute = readSavedRoute();
    if (!savedRoute) {
      router.replace("/upload-route");
    }
  }, [router]);

  const totals = useMemo(() => {
    // Failed stops count as remaining because they still need office review.
    const stops = route?.stops || [];
    return {
      total: stops.length,
      complete: stops.filter((stop) => stop.status === "completed").length,
      remaining: stops.filter((stop) => stop.status !== "completed").length,
    };
  }, [route]);

  const handleExport = () => {
    if (!route) return;

    // Reuse the session export downloader so route summaries behave like the
    // rest of the app's JSON save/export buttons.
    const result = downloadRouteSummary(route);
    setExportMessage(
      result.ok
        ? `Downloaded ${result.filename}`
        : "Failed to export route summary.",
    );
  };

  if (!route) {
    // Keep the transition from the driver screen visually quiet.
    return <main style={styles.loadingScreen} aria-label="Loading summary" />;
  }

  return (
    <main style={styles.safeArea}>
      <section style={styles.container}>
        <div style={styles.topBar}>
          <h1 style={styles.appHeader}>Driver Assist</h1>
        </div>

        <section style={styles.summarySection}>
          <h2 style={styles.sectionTitle}>Summary</h2>
          <div style={styles.statsRow}>
            <SummaryStatBlock value={totals.total} label="Total" />
            <SummaryStatBlock value={totals.complete} label="Complete" />
            <SummaryStatBlock value={totals.remaining} label="Remaining" />
          </div>
        </section>

        <section style={styles.stopList} aria-label="Route stops">
          {route.stops.map((stop) => (
            <SummaryStopCard key={stop.id} stop={stop} />
          ))}
        </section>

        {/* Same footer as the edit flow so the PWA keeps the b2 baseline. */}
        <DriverFooter />
      </section>

      {/* Sticky mobile export action, matching the driver's Finish button. */}
      <div style={styles.exportBar}>
        {exportMessage ? (
          <p style={styles.exportMessage}>{exportMessage}</p>
        ) : null}
        <button
          type="button"
          style={styles.exportButton}
          onClick={handleExport}
        >
          Export route summary
        </button>
      </div>
    </main>
  );
}
