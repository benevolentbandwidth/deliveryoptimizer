import type { DeliveryStop } from "@/lib/driver-route/types";

import { styles } from "../styles";
import InfoLine from "./InfoLine";
import {
  DeliveredIcon,
  NavigateIcon,
  NoteIcon,
  PersonIcon,
  PhoneIcon,
  ReportIcon,
} from "./icons";

type StopCardProps = {
  stop: DeliveryStop;
  isOpen: boolean;
  onToggle: () => void;
  onChangeNote: (value: string) => void;
  onComplete: () => void;
  onReport?: () => void;
  onNavigate?: () => void;
};

export default function StopCard({
  stop,
  isOpen,
  onToggle,
  onChangeNote,
  onComplete,
  onReport,
  onNavigate,
}: StopCardProps) {
  // Completed and failed stops are read-only history items in this card.
  const isCompleted = stop.status === "completed";
  const isFailed = stop.status === "failed";
  const isDone = isCompleted || isFailed;
  const completedAtText = stop.completedAt
    ? new Date(stop.completedAt).toLocaleString()
    : null;
  const phoneNumber = stop.phoneNumber?.trim();
  const packageText =
    stop.packageCount === 1 ? "1 package" : `${stop.packageCount} packages`;

  return (
    <article
      style={{
        ...styles.card,
        ...(isCompleted ? styles.completedCard : {}),
        ...(isFailed ? styles.failedCard : {}),
      }}
    >
      {/* The whole summary row toggles details, which is easier on a phone. */}
      <button type="button" style={styles.cardButton} onClick={onToggle}>
        <span style={styles.textBlock}>
          <span style={styles.stopMetaRow}>
            <span style={styles.stopNumberBadge}>{stop.stopNumber}</span>
            <span style={styles.stopWindow}>{packageText}</span>
          </span>
          <strong style={styles.addressText}>{stop.address}</strong>
          <InfoLine icon={<PersonIcon />} text={stop.customerName} />
          <InfoLine icon={<NoteIcon />} text={stop.notes || "N/A"} />
        </span>
      </button>

      {isOpen ? (
        <div style={styles.expandedSection}>
          {/* Keep navigation prominent for the active stop. */}
          <button
            type="button"
            style={styles.primaryActionButton}
            onClick={onNavigate}
          >
            <NavigateIcon />
            Navigate
          </button>

          {/* Only pending stops can be marked delivered from the driver view. */}
          {!isDone ? (
            <button
              type="button"
              style={styles.deliveredButton}
              onClick={onComplete}
            >
              <DeliveredIcon />
              Delivered
            </button>
          ) : null}

          {/* Notes remain editable after completion so drivers can clean up
              details before exporting the summary. */}
          <textarea
            style={styles.noteInput}
            value={stop.notes}
            onChange={(event) => onChangeNote(event.target.value)}
            placeholder="Add delivery note"
          />

          {isCompleted && completedAtText ? (
            <p style={styles.statusText}>Completed at: {completedAtText}</p>
          ) : null}

          {isFailed && stop.failureReason ? (
            <p style={styles.statusText}>
              Failure reason: {stop.failureReason}
            </p>
          ) : null}

          {/* Call/report are intentionally hidden once a stop is done. */}
          {!isDone ? (
            <div
              style={{
                ...styles.buttonRow,
                ...(phoneNumber ? {} : styles.singleButtonRow),
              }}
            >
              {phoneNumber ? (
                <a
                  href={`tel:${phoneNumber}`}
                  role="button"
                  aria-label={`Call ${stop.customerName}`}
                  style={styles.actionButton}
                >
                  <PhoneIcon />
                  Call
                </a>
              ) : null}
              <button
                type="button"
                style={styles.actionButton}
                onClick={onReport}
              >
                <ReportIcon />
                Report issue
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
