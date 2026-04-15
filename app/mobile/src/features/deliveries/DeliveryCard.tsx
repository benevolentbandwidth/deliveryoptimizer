import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DeliveryStop } from './types';

type Props = {
  stop: DeliveryStop;
  isOpen: boolean;
  onToggle: () => void;
  onChangeNote: (value: string) => void;
  onComplete: () => void;
  onReport: () => void;
  onNavigate?: () => void;
  isReporting: boolean;
  failureReason: string;
  onChangeFailureReason: (value: string) => void;
  onSubmitFailure: (reason: string) => void;
};

export default function DeliveryCard({
  stop,
  isOpen,
  onToggle,
  onChangeNote,
  onComplete,
  onReport,
  onNavigate,
  isReporting,
  failureReason,
  onChangeFailureReason,
  onSubmitFailure,
}: Props) {
  const isCompleted = stop.status === 'completed';
  const isFailed = stop.status === 'failed';
  const isDone = isCompleted || isFailed;
  const canSubmitFailure = failureReason.trim().length > 0;
  const completedAtText = stop.completedAt
    ? new Date(stop.completedAt).toLocaleString()
    : null;

  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.card,
        isCompleted && styles.completedCard,
        isFailed && styles.failedCard,
      ]}
    >
      <View style={styles.headerRow}>
        <View
          style={[
            styles.statusCircle,
            isCompleted && styles.completedCircle,
            isFailed && styles.failedCircle,
          ]}
        />

        <View style={styles.textBlock}>
          <Text style={styles.stopText}>Stop {stop.stopNumber}</Text>
          <Text style={styles.nameText}>{stop.customerName}</Text>

          {stop.phoneNumber ? (
            <Text style={styles.phoneText}>{stop.phoneNumber}</Text>
          ) : null}

          <Text style={styles.addressText}>{stop.address}</Text>
        </View>
      </View>

      {isOpen && (
        <View style={styles.expandedSection}>
          <Text style={styles.metaText}>Packages: {stop.packageCount}</Text>

          <TextInput
            style={styles.noteInput}
            value={stop.notes}
            onChangeText={onChangeNote}
            placeholder="Add delivery note"
            multiline
          />

          {isCompleted && completedAtText ? (
            <Text style={styles.statusText}>Completed at: {completedAtText}</Text>
          ) : null}

          {isFailed && stop.failureReason ? (
            <Text style={styles.statusText}>Failure reason: {stop.failureReason}</Text>
          ) : null}

          {!isDone && !isReporting && (
            <View style={styles.buttonRow}>
              <Pressable style={styles.actionButton} onPress={onComplete}>
                <Text style={styles.actionText}>Complete</Text>
              </Pressable>

              {onNavigate && (
                <Pressable style={styles.actionButton} onPress={onNavigate}>
                  <Text style={styles.actionText}>Navigate</Text>
                </Pressable>
              )}

              <Pressable style={styles.actionButton} onPress={onReport}>
                <Text style={styles.actionText}>Report</Text>
              </Pressable>
            </View>
          )}

          {isReporting && (
            <View>
              <TextInput
                style={styles.noteInput}
                value={failureReason}
                onChangeText={onChangeFailureReason}
                placeholder="Enter failure reason"
                multiline
              />
              <Pressable
                style={[
                  styles.actionButton,
                  !canSubmitFailure && styles.disabledButton,
                ]}
                disabled={!canSubmitFailure}
                onPress={() => onSubmitFailure(failureReason)}
              >
                <Text
                  style={[
                    styles.actionText,
                    !canSubmitFailure && styles.disabledText,
                  ]}
                >
                  Mark as Failed
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },
  completedCard: {
    backgroundColor: '#e5e7eb',
  },
  failedCard: {
    backgroundColor: '#fee2e2',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    marginTop: 4,
    marginRight: 12,
  },
  completedCircle: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  failedCircle: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  textBlock: {
    flex: 1,
  },
  stopText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
    color: '#111827',
  },
  nameText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 2,
  },
  phoneText: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 16,
    color: '#374151',
  },
  expandedSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  metaText: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
  },
  noteInput: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 12,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  statusText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionText: {
    fontWeight: '600',
    color: '#111827',
  },
  disabledButton: {
    backgroundColor: '#f9fafb',
    borderColor: '#d1d5db',
  },
  disabledText: {
    color: '#9ca3af',
  },
});
