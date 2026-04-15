import * as DocumentPicker from 'expo-document-picker';
import React, { useState } from 'react';
import {Alert,LayoutAnimation,Platform,SafeAreaView,ScrollView,StyleSheet,Text,TouchableOpacity,UIManager,View} from 'react-native';

import DeliveryCard from '../../src/features/deliveries/DeliveryCard';
import { loadSessionFromDocument } from '../../src/features/deliveries/importSession';
import { transformSessionToDriverRoute } from '../../src/features/deliveries/transformSession';
import type { DriverRoute, DeliveryStop } from '../../src/features/deliveries/types';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export default function HomeScreen() {
  const [route, setRoute] = useState<DriverRoute | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reportingStopId, setReportingStopId] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState('');

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
    } catch (error) {
      console.error('Failed to import route JSON', error);
      Alert.alert('Import failed', 'Please upload a valid JSON file.');
    }
  };

  const updateStop = (stopId: string, changes: Partial<DeliveryStop>) => {
    if (!route) return;

    const updatedStops = route.stops.map((stop) => {
      if (stop.id === stopId) {
        return { ...stop, ...changes };
      }
      return stop;
    });

    setRoute({
      ...route,
      stops: updatedStops,
    });
  };

  const handleToggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId(openId === id ? null : id);
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
    setFailureReason('');
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
    setFailureReason('');
  };

  const handleNavigate = (stopId: string) => {
    console.log('Navigate to stop:', stopId);
  };

  const stops = route?.stops || [];
  const pendingStops = stops.filter((stop) => stop.status === 'pending');
  const completedStops = stops.filter((stop) => stop.status !== 'pending');

  const remaining = pendingStops.length;
  const completed = stops.filter((stop) => stop.status === 'completed').length;
  const failed = stops.filter((stop) => stop.status === 'failed').length;
  const total = stops.length;
  const progress = total > 0 ? completed / total : 0;

  if (!route) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.uploadScreen}>
          <Text style={styles.appHeader}>Driver Assist</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={handleImportJson}>
            <Text style={styles.uploadButtonText}>Upload JSON</Text>
          </TouchableOpacity>
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
              {completed}/{total} Deliveries Complete
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statNumber}>{remaining}</Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>

            <View style={styles.statBlock}>
              <Text style={styles.statNumber}>{failed}</Text>
              <Text style={styles.statLabel}>Failed</Text>
            </View>

            <View style={styles.statBlock}>
              <Text style={styles.statNumber}>{completed}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>
        </View>

        {pendingStops.map((stop) => (
          <DeliveryCard
            key={stop.id}
            stop={stop}
            isOpen={openId === stop.id}
            onToggle={() => handleToggle(stop.id)}
            onChangeNote={(value) => handleChangeNote(stop.id, value)}
            onComplete={() => handleComplete(stop.id)}
            onReport={() => handleReport(stop.id)}
            onNavigate={() => handleNavigate(stop.id)}
            isReporting={reportingStopId === stop.id}
            failureReason={failureReason}
            onChangeFailureReason={setFailureReason}
            onSubmitFailure={(reason) => handleSubmitFailure(stop.id, reason)}
          />
        ))}

        {completedStops.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>History</Text>

            {completedStops.map((stop) => (
              <DeliveryCard
                key={stop.id}
                stop={stop}
                isOpen={openId === stop.id}
                onToggle={() => handleToggle(stop.id)}
                onChangeNote={(value) => handleChangeNote(stop.id, value)}
                onComplete={() => {}}
                onReport={() => {}}
                onNavigate={() => {}}
                isReporting={false}
                failureReason={''}
                onChangeFailureReason={() => {}}
                onSubmitFailure={() => {}}
              />
            ))}
          </View>
        )}
      </ScrollView>
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
});
