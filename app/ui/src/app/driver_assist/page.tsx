"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { DeliveryStop, DriverRoute } from "@/lib/driver-route/types";

import DriverFooter from "./components/DriverFooter";
import ReportIssueDialog, {
  type ReportReason,
} from "./components/ReportIssueDialog";
import StatBlock from "./components/StatBlock";
import StopCard from "./components/StopCard";
import { WarningIcon } from "./components/icons";
import {
  clearUploadedRouteFile,
  persistRoute,
  readSavedRoute,
  readUploadedRouteFile,
} from "./storage";
import { styles } from "./styles";
import {
  parseRouteUploadFile,
  ROUTE_UPLOAD_ERROR_KEY,
} from "@/app/upload-route/routeUploadValidation";

function openNavigation(stop: DeliveryStop) {
  // Prefer exact coordinates from the route file; fall back to the address if
  // the saved JSON came from an older flow without geocoded locations.
  const query =
    stop.lat !== 0 || stop.lng !== 0
      ? `${stop.lat},${stop.lng}`
      : encodeURIComponent(stop.address);

  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${query}`,
    "_blank",
  );
}

export default function DriverAssistPwaPage() {
  const router = useRouter();
  const topRef = useRef<HTMLDivElement>(null);
  const remainingRef = useRef<HTMLDivElement>(null);
  const deliveredRef = useRef<HTMLDivElement>(null);
  const reportedRef = useRef<HTMLDivElement>(null);
  const [route, setRoute] = useState<DriverRoute | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reportStopId, setReportStopId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>(
    "Customer unavailable",
  );
  const [reportDetails, setReportDetails] = useState("");
  const [hasCheckedRoute, setHasCheckedRoute] = useState(false);

  useEffect(() => {
    // The upload page hands off the raw JSON through sessionStorage so this
    // page can import once, save the driver shape, and avoid bouncing back.
    const uploadedRoute = readUploadedRouteFile();

    if (uploadedRoute) {
      try {
        const nextRoute = parseRouteUploadFile(
          uploadedRoute.name,
          uploadedRoute.content,
        );
        persistRoute(nextRoute);
        clearUploadedRouteFile();
        queueMicrotask(() => {
          setRoute(nextRoute);
          setOpenId(nextRoute.stops[0]?.id || null);
          setHasCheckedRoute(true);
        });
        return;
      } catch (importError) {
        const message =
          importError instanceof Error
            ? importError.message
            : "Please upload a valid JSON file.";
        clearUploadedRouteFile();
        sessionStorage.setItem(ROUTE_UPLOAD_ERROR_KEY, message);
        router.replace("/upload-route");
        return;
      }
    }

    // Reloading the PWA should keep the driver exactly where they left off.
    const savedRoute = readSavedRoute();

    if (!savedRoute) {
      router.replace("/upload-route");
      return;
    }

    queueMicrotask(() => {
      setRoute(savedRoute);
      setOpenId(savedRoute.stops[0]?.id || null);
      setHasCheckedRoute(true);
    });
  }, [router]);

  useEffect(() => {
    // Persist every delivery status/note change so refreshes do not lose work.
    if (!route) return;
    persistRoute(route);
  }, [route]);

  const totals = useMemo(() => {
    const stops = route?.stops || [];
    const completed = stops.filter(
      (stop) => stop.status === "completed",
    ).length;
    const failed = stops.filter((stop) => stop.status === "failed").length;
    const pending = stops.filter((stop) => stop.status === "pending").length;

    return {
      completed,
      failed,
      pending,
      total: stops.length,
      progress: stops.length > 0 ? completed / stops.length : 0,
    };
  }, [route]);

  const updateStop = (stopId: string, changes: Partial<DeliveryStop>) => {
    // Keep stop updates narrow so notes, status, and failure reasons can share
    // one path without rebuilding the whole route by hand.
    setRoute((current) => {
      if (!current) return current;

      return {
        ...current,
        stops: current.stops.map((stop) =>
          stop.id === stopId ? { ...stop, ...changes } : stop,
        ),
      };
    });
  };

  const openReportDialog = (stopId: string) => {
    setReportStopId(stopId);
    setReportReason("Customer unavailable");
    setReportDetails("");
  };

  const closeReportDialog = () => {
    setReportStopId(null);
    setReportDetails("");
  };

  const submitReport = () => {
    if (!reportStopId) return;
    // "Other" only becomes the saved reason once the driver confirms it.
    const reason =
      reportReason === "Other" ? reportDetails.trim() || "Other" : reportReason;

    updateStop(reportStopId, {
      status: "failed",
      failureReason: reason,
    });
    setOpenId(null);
    closeReportDialog();
  };

  const finishRoute = () => {
    // Save one last time before moving to the export summary screen.
    if (route) {
      persistRoute(route);
    }
    router.push("/driver_assist/summary");
  };

  const scrollToSection = (target: React.RefObject<HTMLElement | null>) => {
    target.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pendingStops =
    route?.stops.filter((stop) => stop.status === "pending") || [];
  const deliveredStops =
    route?.stops.filter((stop) => stop.status === "completed") || [];
  const reportedStops =
    route?.stops.filter((stop) => stop.status === "failed") || [];

  if (!hasCheckedRoute || !route) {
    // Empty shell prevents the black-and-white upload screen from flashing
    // while local/session storage is being checked.
    return <main style={styles.loadingScreen} aria-label="Loading route" />;
  }

  return (
    <main style={styles.safeArea}>
      <section ref={topRef} style={styles.container}>
        <div style={styles.topBar}>
          <h1 style={styles.appHeader}>Driver Assist</h1>
          <button
            type="button"
            style={styles.iconButton}
            onClick={() => scrollToSection(reportedRef)}
            aria-label="View reported deliveries"
          >
            <WarningIcon />
          </button>
        </div>

        <section style={styles.summaryCard}>
          <div style={styles.statsRow}>
            <StatBlock
              value={totals.total}
              label="Total"
              onClick={() => scrollToSection(topRef)}
            />
            <StatBlock
              value={totals.completed}
              label="Complete"
              onClick={() => scrollToSection(deliveredRef)}
            />
            <StatBlock
              value={totals.pending}
              label="Remaining"
              onClick={() => scrollToSection(remainingRef)}
            />
          </div>

          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressFill,
                width: `${totals.progress * 100}%`,
              }}
            />
          </div>
        </section>

        {/* Remaining is the active work queue, so it stays first and expanded. */}
        <section ref={remainingRef} style={styles.routeSection}>
          <h2 style={styles.sectionTitle}>Remaining</h2>

          {pendingStops.map((stop) => (
            <StopCard
              key={stop.id}
              stop={stop}
              isOpen={openId === stop.id}
              onToggle={() => setOpenId(openId === stop.id ? null : stop.id)}
              onChangeNote={(notes) => updateStop(stop.id, { notes })}
              onComplete={() => {
                updateStop(stop.id, {
                  status: "completed",
                  completedAt: new Date().toISOString(),
                });
                setOpenId(null);
              }}
              onReport={() => openReportDialog(stop.id)}
              onNavigate={() => openNavigation(stop)}
            />
          ))}
        </section>

        {/* Delivered and reported stops stay available for review, but without
            the live completion/report controls. */}
        <section ref={deliveredRef} style={styles.historySection}>
          {deliveredStops.length > 0 ? (
            <>
              <h2 style={styles.historyTitle}>Delivered</h2>
              {deliveredStops.map((stop) => (
                <StopCard
                  key={stop.id}
                  stop={stop}
                  isOpen={openId === stop.id}
                  onToggle={() =>
                    setOpenId(openId === stop.id ? null : stop.id)
                  }
                  onChangeNote={(notes) => updateStop(stop.id, { notes })}
                  onComplete={() => undefined}
                  onReport={() => undefined}
                  onNavigate={() => openNavigation(stop)}
                />
              ))}
            </>
          ) : null}
        </section>

        <section ref={reportedRef} style={styles.historySection}>
          {reportedStops.length > 0 ? (
            <>
              <h2 style={styles.historyTitle}>Reported</h2>
              {reportedStops.map((stop) => (
                <StopCard
                  key={stop.id}
                  stop={stop}
                  isOpen={openId === stop.id}
                  onToggle={() =>
                    setOpenId(openId === stop.id ? null : stop.id)
                  }
                  onChangeNote={(notes) => updateStop(stop.id, { notes })}
                  onComplete={() => undefined}
                  onReport={() => undefined}
                  onNavigate={() => openNavigation(stop)}
                />
              ))}
            </>
          ) : null}
        </section>

        <DriverFooter />
      </section>

      <div style={styles.finishBar}>
        <button type="button" style={styles.finishButton} onClick={finishRoute}>
          Finish
        </button>
      </div>

      {reportStopId ? (
        <ReportIssueDialog
          reason={reportReason}
          details={reportDetails}
          onReasonChange={setReportReason}
          onDetailsChange={setReportDetails}
          onCancel={closeReportDialog}
          onSubmit={submitReport}
        />
      ) : null}
    </main>
  );
}
