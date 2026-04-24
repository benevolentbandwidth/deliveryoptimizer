import * as DocumentPicker from 'expo-document-picker';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

import DeliveryCard from '@/src/features/deliveries/DeliveryCard';
import { exportEndOfShiftSummary } from '@/src/features/deliveries/endShift';
import { loadSessionFromDocument } from '@/src/features/deliveries/importSession';
import { transformSessionToDriverRoute } from '@/src/features/deliveries/transformSession';
import { useRoutePersistence } from '@/src/features/deliveries/useRoutePersistence';
import type { DeliveryStop } from '@/src/features/deliveries/types';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export default function HomeScreen() {
  const { route, setRoute, clearRoute, isRestored, storageAvailable } = useRoutePersistence();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reportingStopId, setReportingStopId] = useState<string | null>(null);
  const [isEndShiftModalVisible, setIsEndShiftModalVisible] = useState(false);
  const [endReason, setEndReason] = useState('');
  const [isEndingRoute, setIsEndingRoute] = useState(false);

  useEffect(() => {
    if (!route) {
      setOpenId(null);
      return;
    }

    if (openId && route.stops.some((stop) => stop.id === openId)) {
      return;
    }

    const firstPendingStop = route.stops.find((stop) => stop.status === 'pending');
    setOpenId(firstPendingStop?.id || route.stops[0]?.id || null);
  }, [route, openId]);

  const resetTransientState = () => {
    setOpenId(null);
    setReportingStopId(null);
    setEndReason('');
    setIsEndShiftModalVisible(false);
  };

  const handleImportJson = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];
      if (!file) {
        Alert.alert('Import failed', 'No file selected.');
        return;
      }

      const routeData = await loadSessionFromDocument(file);
      const newRoute = transformSessionToDriverRoute(routeData);
      setRoute(newRoute);
      setOpenId(newRoute.stops[0]?.id || null);
      setReportingStopId(null);
      setEndReason('');
    } catch (error) {
      console.error('Failed to import route JSON', error);
      Alert.alert('Import failed', 'Please upload a valid JSON file.');
    }
  };

  const updateStop = (stopId: string, updates: Partial<DeliveryStop>) => {
    setRoute((currentRoute) => {
      if (!currentRoute) {
        return currentRoute;
      }

      const updatedStops = currentRoute.stops.map((stop) => {
        if (stop.id === stopId) {
          return { ...stop, ...updates };
        }
        return stop;
      });

      return {
        ...currentRoute,
        stops: updatedStops,
      };
    });
  };

  const handleToggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setReportingStopId(null);
    setOpenId((currentOpenId) => (currentOpenId === id ? null : id));
  };

  const handleChangeNote = (stopId: string, value: string) => {
    updateStop(stopId, { notes: value });
  };

  const handleComplete = (stopId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    updateStop(stopId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    setOpenId(null);
  };

  const handleReport = (stopId: string) => {
    setReportingStopId(stopId);
    setOpenId(stopId);
  };

  const handleCancelReport = () => {
    setReportingStopId(null);
  };

  const handleSubmitFailure = (stopId: string, reason: string) => {
    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      Alert.alert('Failure reason required', 'Please enter a reason before submitting.');
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    updateStop(stopId, {
      status: 'failed',
      failureReason: trimmedReason,
    });

    setReportingStopId(null);
    setOpenId(null);
  };

  const handleNavigate = async (stopId: string) => {
    const stop = route?.stops.find((routeStop) => routeStop.id === stopId);

    if (!stop) {
      Alert.alert('Navigation failed', 'We could not find that stop.');
      return;
    }

    const destination = `${stop.lat},${stop.lng}`;
    const encodedDestination = encodeURIComponent(destination);
    const googleMapsAppUrl = `comgooglemaps://?daddr=${encodedDestination}&directionsmode=driving`;
    const appleMapsUrl = `https://maps.apple.com/?daddr=${encodedDestination}&dirflg=d`;
    const geoUri = `geo:${destination}?q=${encodedDestination}`;
    const googleMapsWebUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`;

    try {
      if (await Linking.canOpenURL(googleMapsAppUrl)) {
        await Linking.openURL(googleMapsAppUrl);
        return;
      }

      if (Platform.OS === 'ios') {
        await Linking.openURL(appleMapsUrl);
        return;
      }

      if (await Linking.canOpenURL(geoUri)) {
        await Linking.openURL(geoUri);
        return;
      }

      await Linking.openURL(googleMapsWebUrl);
    } catch (error) {
      console.error('Failed to open navigation app', error);
      Alert.alert('Navigation failed', 'We could not open a navigation app for this stop.');
    }
  };
  const handleFinishRoute = () => {
    if (!route) {
      return;
    }

    setEndReason('');
    setIsEndShiftModalVisible(true);
  };

  const handleCancelEndShift = () => {
    if (isEndingRoute) {
      return;
    }

    setIsEndShiftModalVisible(false);
    setEndReason('');
  };

  const handleConfirmEndShift = async () => {
    if (!route || isEndingRoute) {
      return;
    }

    setIsEndingRoute(true);

    try {
      await exportEndOfShiftSummary(route, endReason);
      clearRoute();
      resetTransientState();
      Alert.alert('Shift ended', 'Your route was cleared after exporting the shift summary.');
    } catch (error) {
      console.error('Failed to end route', error);
      Alert.alert('End shift failed', 'We could not export the end-of-shift summary.');
    } finally {
      setIsEndingRoute(false);
    }
  };

  const stops = route?.stops || [];
  const pendingStops = stops.filter((stop) => stop.status === 'pending');
  const historicalStops = stops.filter((stop) => stop.status !== 'pending');
  const completedCount = stops.filter((stop) => stop.status === 'completed').length;
  const failedCount = stops.filter((stop) => stop.status === 'failed').length;
  const progress = stops.length > 0 ? completedCount / stops.length : 0;

  if (!isRestored) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.uploadScreen}>
          <Text style={styles.appHeader}>Driver Assist</Text>
          <Text style={styles.uploadHint}>Restoring saved route...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!route) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.uploadScreen}>
          <Text style={styles.appHeader}>Driver Assist</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={handleImportJson}>
            <Text style={styles.uploadButtonText}>Upload JSON</Text>
          </TouchableOpacity>
          {storageAvailable ? (
            <Text style={styles.uploadHint}>
              Saved routes reopen automatically for up to 24 hours.
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.appHeader}>Driver Assist</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.headerLabel}>Current Route</Text>
          <Text style={styles.driverName}>{route.driverName}</Text>
          <Text style={styles.routeLabel}>{route.routeLabel}</Text>

          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>Progress</Text>
            <Text style={styles.progressText}>
              {completedCount}/{stops.length} Deliveries Complete
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statNumber}>{pendingStops.length}</Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>

            <View style={styles.statBlock}>
              <Text style={styles.statNumber}>{failedCount}</Text>
              <Text style={styles.statLabel}>Failed</Text>
            </View>

            <View style={styles.statBlock}>
              <Text style={styles.statNumber}>{completedCount}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>

          <Pressable style={styles.finishRouteButton} onPress={handleFinishRoute}>
            <Text style={styles.finishRouteButtonText}>Finish Route</Text>
          </Pressable>
        </View>

        {pendingStops.map((stop) => (
          <DeliveryCard
            key={stop.id}
            stop={stop}
            isOpen={openId === stop.id}
            onToggle={() => handleToggle(stop.id)}
            onChangeNote={(value) => handleChangeNote(stop.id, value)}
            onNavigate={() => handleNavigate(stop.id)}
            onComplete={() => handleComplete(stop.id)}
            onReport={() => handleReport(stop.id)}
            isReporting={reportingStopId === stop.id}
            onCancelReport={handleCancelReport}
            onSubmitFailure={(reason) => handleSubmitFailure(stop.id, reason)}
          />
        ))}

        {historicalStops.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>History</Text>

            {historicalStops.map((stop) => (
              <DeliveryCard
                key={stop.id}
                stop={stop}
                isOpen={openId === stop.id}
                onToggle={() => handleToggle(stop.id)}
                onChangeNote={(value) => handleChangeNote(stop.id, value)}
                onNavigate={() => handleNavigate(stop.id)}
                onComplete={() => {}}
                onReport={() => {}}
                isReporting={false}
                onCancelReport={() => {}}
                onSubmitFailure={() => {}}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={isEndShiftModalVisible}
        onRequestClose={handleCancelEndShift}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pendingStops.length > 0 ? 'End Route With Incomplete Stops?' : 'Finish Route?'}
            </Text>

            <Text style={styles.modalBody}>
              {pendingStops.length > 0
                ? `You have ${pendingStops.length} incomplete stop${
                    pendingStops.length === 1 ? '' : 's'
                  }. End anyway?`
                : 'This will export an end-of-shift summary and reset the active route.'}
            </Text>

            <TextInput
              style={styles.modalInput}
              value={endReason}
              onChangeText={setEndReason}
              placeholder="End reason (optional)"
              multiline
            />

            <View style={styles.modalButtonRow}>
              <Pressable style={styles.modalSecondaryButton} onPress={handleCancelEndShift}>
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.modalPrimaryButton, isEndingRoute && styles.disabledPrimaryButton]}
                onPress={handleConfirmEndShift}
                disabled={isEndingRoute}
              >
                <Text style={styles.modalPrimaryButtonText}>
                  {isEndingRoute ? 'Ending...' : 'End Shift'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  uploadScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  appHeader: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  uploadButton: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  uploadHint: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  container: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#4b5563',
  },
  headerLabel: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 8,
  },
  driverName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111827',
  },
  routeLabel: {
    fontSize: 18,
    color: '#374151',
    marginBottom: 18,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 15,
    color: '#111827',
  },
  progressTrack: {
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 18,
  },
  progressFill: {
    height: 12,
    backgroundColor: '#22c55e',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    borderRadius: 18,
    paddingVertical: 18,
    marginBottom: 16,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 4,
  },
  historySection: {
    marginTop: 8,
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  finishRouteButton: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  finishRouteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    minHeight: 88,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSecondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  modalPrimaryButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#111827',
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledPrimaryButton: {
    backgroundColor: '#9ca3af',
  },
  modalPrimaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
