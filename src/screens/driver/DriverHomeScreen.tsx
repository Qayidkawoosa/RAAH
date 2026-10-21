import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View, TextInput, TouchableOpacity, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Siren, Users } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppCard } from '../../components/ui/AppCard';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { Badge } from '../../components/ui/Badge';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { SafetyScoreRing } from '../../components/SafetyScoreRing';
import { BusMap } from '../../components/BusMap';
import { useBusLocations } from '../../hooks/useBusLocations';
import { AlertListItem } from '../../components/AlertListItem';
import { useAuth } from '../../context/AuthContext';
import { useTrip } from '../../context/TripContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { SPEED_LIMIT_KMH } from '../../constants/safety';
import { DEMO_BUS_NO, DEMO_ROUTE_PATH_B, ALL_ROUTES } from '../../constants/demoRoute';
import { AppStackParamList } from '../../navigation/types';
import { formatKm } from '../../utils/format';
import { bearingDegrees } from '../../utils/geo';
import { ScheduleBanner } from '../../components/ScheduleBanner';
import { DMSHeadsUpDisplay } from '../../components/DMSHeadsUpDisplay';
import { backgroundDmsService } from '../../services/dms/backgroundDmsService';
import { dmsEngine } from '../../services/dms/dmsEngine';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const DriverHomeScreen: React.FC = () => {
  const { user } = useAuth();
  const {
    trip,
    lastPoint,
    liveScore,
    isSimulatedGps,
    upcomingPickup,
    busStudents,
    startTrip,
    autoStartIfDue,
    endTrip,
    triggerSos,
    notifyParentOfPickup,
    setSimulationRoute,
    simulationRoutePath,
  } = useTrip();
  const { colors, spacing } = useAppTheme();
  const navigation = useNavigation<Navigation>();
  const [isDiverging, setIsDiverging] = useState(false);
  const [pickupMessageText, setPickupMessageText] = useState('');
  const [droppedNotified, setDroppedNotified] = useState(false);

  // Reset drop-off notification state on new stop
  useEffect(() => {
    setDroppedNotified(false);
  }, [upcomingPickup?.stopName]);

  const handleDriverDropoff = async () => {
    if (!upcomingPickup) return;
    setDroppedNotified(true);
    try {
      const stored = await AsyncStorage.getItem('@raasta_dropoff_status');
      const current = stored ? JSON.parse(stored) : {};
      
      const targetStudents = busStudents.filter((s) => upcomingPickup.studentNames.includes(s.name));
      const updated = { ...current, [`stop_${upcomingPickup.stopName}`]: 'dropped' };
      targetStudents.forEach((s) => {
        updated[s.id] = 'dropped';
      });
      await AsyncStorage.setItem('@raasta_dropoff_status', JSON.stringify(updated));

      const demoEventsRaw = await AsyncStorage.getItem('@raasta_demo_events');
      const demoEvents = demoEventsRaw ? JSON.parse(demoEventsRaw) : [];
      targetStudents.forEach((s) => {
        demoEvents.push({
          id: `${Date.now()}_${s.id}`,
          type: 'dropped',
          studentName: s.name,
          stopName: upcomingPickup.stopName,
          timestamp: Date.now(),
        });
      });
      await AsyncStorage.setItem('@raasta_demo_events', JSON.stringify(demoEvents));
      Alert.alert('Drop-off Confirmed', `Drop-off recorded for ${upcomingPickup.studentNames.join(', ')}. Parents have been notified.`);
    } catch (e) {}
  };

  const speed = lastPoint?.speedKmh ?? 0;
  const isOverspeed = speed > SPEED_LIMIT_KMH;
  const recentAlerts = trip
    ? [...trip.events].reverse().filter((e) => e.type !== 'trip_started').slice(0, 4)
    : [];

  const stopStudentCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    busStudents.forEach((student) => {
      if (student.pickupStop) {
        counts[student.pickupStop] = (counts[student.pickupStop] ?? 0) + 1;
      }
    });
    return counts;
  }, [busStudents]);

  const selectedRouteConfig = React.useMemo(() => {
    return ALL_ROUTES.find((r) => r.path === simulationRoutePath) ?? ALL_ROUTES[0];
  }, [simulationRoutePath]);

  const activeRouteStops = selectedRouteConfig.stops;
  const driverBusNo = user?.vehicleNo || user?.assignedBusNo;

  const { location: simLocation } = useBusLocations(driverBusNo);

  const currentBusLocation = React.useMemo(() => {
    if (!trip) return null;
    if (lastPoint) {
      const heading = (trip.path && trip.path.length > 1)
        ? bearingDegrees(trip.path[trip.path.length - 2], lastPoint)
        : (simLocation?.heading ?? 45);
      return {
        busId: trip.busNo,
        latitude: lastPoint.latitude,
        longitude: lastPoint.longitude,
        heading,
        speedKmh: Math.round(lastPoint.speedKmh),
        status: isDiverging ? ('delayed' as const) : ('on_route' as const),
        etaMinutes: simLocation?.etaMinutes ?? 10,
        nextStopName: upcomingPickup?.stopName ?? simLocation?.nextStopName ?? 'Hazratbal',
        lastUpdated: lastPoint.timestamp,
        schoolName: user?.schoolName,
        driverName: user?.name,
        complianceStatus: 'Compliant',
      };
    }
    return simLocation;
  }, [trip, lastPoint, simLocation, isDiverging, upcomingPickup, user]);

  // Set initial simulation route on mount based on driver's vehicle number
  useEffect(() => {
    if (user && !trip) {
      const driverRoute = ALL_ROUTES.find((r) => r.busNo === user.vehicleNo) ?? ALL_ROUTES[0];
      setSimulationRoute(driverRoute.path);
    }
  }, [user, trip, setSimulationRoute]);

  // Ensure Background DMS Guard is running ONLY during active trips for drivers
  useEffect(() => {
    if (user?.role === 'driver' && trip && trip.status === 'active') {
      dmsEngine.tripId = trip.id;
      dmsEngine.busId = trip.busNo;
      dmsEngine.driverId = user.uid;
      dmsEngine.setTrackingActive(true);
      if (!backgroundDmsService.isDmsActive()) {
        backgroundDmsService.start();
      }
    } else {
      if (backgroundDmsService.isDmsActive()) {
        backgroundDmsService.stop();
      }
      dmsEngine.setTrackingActive(false);
    }

    return () => {
      if (!trip) {
        backgroundDmsService.stop();
        dmsEngine.setTrackingActive(false);
      }
    };
  }, [trip, user]);

  // Demo Simulation: Poll for cross-tab events from Parent App
  useEffect(() => {
    let active = true;
    let lastCheckedTime = Date.now();
    
    const pollDemoEvents = async () => {
      try {
        const eventsRaw = await AsyncStorage.getItem('@raasta_demo_events');
        if (eventsRaw && active) {
          const events = JSON.parse(eventsRaw);
          const newEvents = events.filter((e: any) => e.timestamp > lastCheckedTime);
          
          if (newEvents.length > 0) {
            lastCheckedTime = Date.now();
            newEvents.forEach((evt: any) => {
              if (evt.type === 'not_dropped') {
                Alert.alert('⚠️ CRITICAL ALERT', `${evt.studentName} flagged as MISSING at ${evt.stopName}!`);
              } else if (evt.type === 'dropped') {
                Alert.alert('Drop-off Completed', `${evt.studentName} was dropped off at ${evt.stopName}.`);
              } else if (evt.type === 'location_changed') {
                Alert.alert('Location Update', `Parent of ${evt.studentName} changed drop-off to ${evt.stopName}. Map updated.`);
              }
            });
          }
        }
      } catch (e) {}
    };

    const interval = setInterval(pollDemoEvents, 1500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Passive Auto-Start disabled to enforce facial recognition pre-check
  // useEffect(() => {
  //   if (!user || trip) return;
  //   let active = true;
  //   const checkAutoStart = async () => {
  //     await new Promise((resolve) => setTimeout(resolve, 1500));
  //     if (!active) return;
  //     const driverRoute = ALL_ROUTES.find((r) => r.busNo === user.vehicleNo) ?? ALL_ROUTES[0];
  //     await autoStartIfDue(user, driverRoute.path);
  //   };
  //   checkAutoStart();
  //   return () => { active = false; };
  // }, [user, trip, autoStartIfDue]);

  const handleStart = async (): Promise<void> => {
    if (user) await startTrip(user, isDiverging ? DEMO_ROUTE_PATH_B : simulationRoutePath);
  };

  const handleEnd = async (): Promise<void> => {
    try {
      await backgroundDmsService.stop();
    } catch (e) {}
    dmsEngine.setTrackingActive(false);
    const finished = await endTrip();
    if (finished) navigation.navigate('TripSummary', { trip: finished });
  };

  const handleRouteToggle = () => {
    const nextDiverging = !isDiverging;
    setIsDiverging(nextDiverging);
    setSimulationRoute(nextDiverging ? DEMO_ROUTE_PATH_B : selectedRouteConfig.path);
  };

  const handleSos = (): void => {
    Alert.alert('Emergency SOS', 'Alert the school, parents and RTO immediately?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send SOS', style: 'destructive', onPress: triggerSos },
    ]);
  };

  const [showCrashModal, setShowCrashModal] = useState(false);
  const [crashCountdown, setCrashCountdown] = useState(10);
  const crashTimerRef = React.useRef<any>(null);

  const startCrashCountdown = () => {
    setCrashCountdown(10);
    setShowCrashModal(true);
    crashTimerRef.current = setInterval(() => {
      setCrashCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(crashTimerRef.current!);
          setShowCrashModal(false);
          triggerSos(); // Trigger actual SOS when countdown ends
          Alert.alert('CRASH REPORTED', 'Emergency services and school admin have been notified.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelCrashCountdown = () => {
    if (crashTimerRef.current) {
      clearInterval(crashTimerRef.current);
    }
    setShowCrashModal(false);
  };

  return (
    <ScreenContainer>
      {/* CRASH COUNTDOWN MODAL */}
      <Modal visible={showCrashModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <Siren size={80} color={colors.textPrimary} style={{ marginBottom: spacing.lg }} />
          <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.md }]}>CRASH DETECTED</Text>
          <Text style={[typography.titleMedium, { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xl }]}>
            Sending emergency alerts in...
          </Text>
          <Text style={{ color: colors.textPrimary, fontSize: 80, fontFamily: 'Poppins-Bold', marginBottom: spacing.xxl }}>
            {crashCountdown}
          </Text>
          <PrimaryButton 
            label="I AM SAFE (Cancel Alert)" 
            onPress={cancelCrashCountdown} 
            style={{ width: '100%', backgroundColor: colors.textPrimary, borderColor: 'transparent' }}
            labelStyle={{ color: colors.danger, fontSize: 18, fontFamily: 'Poppins-Bold' }}
          />
        </View>
      </Modal>



      <ScreenHeader
        title={`Salaam, ${user?.name.split(' ')[0] ?? 'Driver'}`}
        subtitle={driverBusNo ? `${driverBusNo} · ${selectedRouteConfig.routeName}` : selectedRouteConfig.routeName}
        showLogout
        showBrand
      />

      {/* Driver Monitoring System (DMS) Heads-Up Display & Alert Bar ONLY during active trip */}
      {trip && trip.status === 'active' ? (
        <DMSHeadsUpDisplay busId={driverBusNo} driverId={user?.uid} isTripActive={true} />
      ) : (
        <View
          style={{
            marginBottom: spacing.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textTertiary }} />
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: 'Poppins-Medium' }}>
              DMS Camera Standby · Activates on Trip Start
            </Text>
          </View>
          <Badge label="STANDBY" tone="neutral" />
        </View>
      )}

      {!trip ? (
        <Animated.View entering={FadeInDown.duration(350)}>
          <ScheduleBanner audience="driver" style={{ marginBottom: spacing.sm }} />
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(400)}>
        <View style={{ height: 240, borderRadius: 12, overflow: 'hidden' }}>
          <BusMap
            busLocation={trip ? currentBusLocation || null : null}
            routeCoordinates={simulationRoutePath.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
          />
        </View>
        {trip && currentBusLocation && (
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8, textAlign: 'center' }]}>
            Next: {currentBusLocation.nextStopName} ({currentBusLocation.etaMinutes} min) · {currentBusLocation.speedKmh} km/h
          </Text>
        )}
      </Animated.View>

      {/* Route Detour Control Card (simulation mode only) */}
      {trip && isSimulatedGps ? (
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <AppCard style={{ marginTop: spacing.sm, padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Simulation Detour Control</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  {isDiverging ? "Detoured via Boulevard Road (Route B)" : "Following School Assigned Path (Route A)"}
                </Text>
              </View>
              <PrimaryButton
                label={isDiverging ? "Reset to Route A" : "Simulate Detour"}
                onPress={handleRouteToggle}
                variant={isDiverging ? "gradient" : "outline"}
                style={{ minWidth: 120, height: 36, paddingVertical: 0 }}
              />
            </View>
          </AppCard>
        </Animated.View>
      ) : null}

      {/* Upcoming Student Pickup Card */}
      {trip && upcomingPickup ? (
        <Animated.View entering={FadeInDown.duration(400)}>
          <AppCard accent="default" style={{ marginTop: spacing.md }}>
            <View style={styles.pickupRow}>
              <View style={[styles.pickupIconWrap, { backgroundColor: `${colors.primary}1A` }]}>
                <Users size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, paddingHorizontal: 10 }}>
                <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                  Approaching Stop: {upcomingPickup.stopName}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 1 }]}>
                  Pick up: {upcomingPickup.studentNames.join(', ')}
                </Text>
              </View>
              <View style={{ gap: 6, alignItems: 'flex-end' }}>
                <PrimaryButton
                  label={upcomingPickup.parentNotified ? "Boarded ✓" : "Confirm Boarding"}
                  onPress={() => {
                    if (pickupMessageText.trim().length > 0) {
                      notifyParentOfPickup(`Message to parent: ${pickupMessageText.trim()}`);
                      setPickupMessageText('');
                    } else {
                      notifyParentOfPickup();
                    }
                  }}
                  disabled={upcomingPickup.parentNotified}
                  variant={upcomingPickup.parentNotified ? "outline" : "gradient"}
                  style={{ height: 32, paddingVertical: 0, minWidth: 125 }}
                />
                <PrimaryButton
                  label={droppedNotified ? "Dropped ✓" : "Confirm Drop-off"}
                  onPress={handleDriverDropoff}
                  disabled={droppedNotified}
                  variant={droppedNotified ? "outline" : "gradient"}
                  style={{ height: 32, paddingVertical: 0, minWidth: 125 }}
                />
              </View>
            </View>

            {/* Direct custom message to parent */}
            {!upcomingPickup.parentNotified ? (
              <View style={{ marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingTop: 12 }}>
                <Text style={[typography.caption, { color: colors.textSecondary, fontFamily: 'Poppins-Medium', marginBottom: 6 }]}>
                  Send message to parents (optional):
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    placeholder="Type message (e.g. Bus is arriving in 2 mins)"
                    placeholderTextColor={colors.textSecondary}
                    value={pickupMessageText}
                    onChangeText={setPickupMessageText}
                    style={{
                      borderColor: colors.border,
                      color: colors.textPrimary,
                      backgroundColor: colors.card,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      height: 36,
                      flex: 1,
                      fontFamily: 'Poppins-Regular',
                      fontSize: 12,
                      borderWidth: 1,
                    }}
                  />
                  <PrimaryButton
                    label="Send Msg"
                    onPress={() => {
                      if (pickupMessageText.trim().length > 0) {
                        notifyParentOfPickup(`Message to parent: ${pickupMessageText.trim()}`);
                        setPickupMessageText('');
                      } else {
                        Alert.alert('Empty Message', 'Please type a message first or tap Confirm Boarding.');
                      }
                    }}
                    variant="gradient"
                    style={{ height: 36, paddingVertical: 0, minWidth: 80 }}
                  />
                </View>
              </View>
            ) : null}
          </AppCard>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(80).duration(400)} style={[styles.statsRow, { marginTop: spacing.md }]}>
        <AppCard style={styles.speedCard}>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Current Speed</Text>
          <Text style={[typography.h1, { color: isOverspeed ? colors.danger : colors.textPrimary }]}>
            {Math.round(speed)}
            <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}> km/h</Text>
          </Text>
          <Badge
            label={isOverspeed ? `Over ${SPEED_LIMIT_KMH} km/h limit` : `Limit ${SPEED_LIMIT_KMH} km/h`}
            tone={isOverspeed ? 'danger' : 'success'}
          />
          {trip ? (
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 8 }]}>
              {formatKm(trip.distanceKm)} covered
            </Text>
          ) : null}
        </AppCard>
        <AppCard style={styles.scoreCard}>
          <SafetyScoreRing score={trip ? liveScore : 100} size={104} />
        </AppCard>
      </Animated.View>

      {trip ? (
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
          {isSimulatedGps ? 'GPS unavailable — demo drive simulation active · ' : ''}
          Trip ends automatically when the bus reaches the school
        </Text>
      ) : null}

      <Animated.View entering={FadeInDown.delay(160).duration(400)} style={{ marginTop: spacing.lg }}>
        {trip ? (
          <>
            <View style={styles.actionsRow}>
              <PrimaryButton label="End Trip" onPress={handleEnd} style={styles.actionButton} />
              <PrimaryButton
                label={trip.status === 'sos' ? 'SOS SENT' : 'SOS'}
                onPress={handleSos}
                variant="danger"
                disabled={trip.status === 'sos'}
                style={styles.sosButton}
              />
            </View>
          </>
        ) : (
          <PrimaryButton 
            label="Start Trip" 
            onPress={handleStart} 
            variant="gradient"
          />
        )}
      </Animated.View>

      {trip?.status === 'sos' ? (
        <AppCard accent="danger" style={{ marginTop: spacing.md }}>
          <View style={styles.sosRow}>
            <Siren size={18} color={colors.danger} />
            <Text style={[typography.titleMedium, { color: colors.danger, marginLeft: 8 }]}>
              SOS broadcast to school, parents and RTO
            </Text>
          </View>
        </AppCard>
      ) : null}

      {/* EMERGENCY CONTROLS */}
      {trip ? (
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <AppCard accent="danger" style={{ marginTop: spacing.md, padding: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <PrimaryButton
                label="Simulate Crash"
                onPress={startCrashCountdown}
                variant="danger"
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label="Simulate Off-Route"
                onPress={async () => {
                  try {
                    const demoEventsRaw = await AsyncStorage.getItem('@raasta_demo_events');
                    const demoEvents = demoEventsRaw ? JSON.parse(demoEventsRaw) : [];
                    demoEvents.push({
                      id: Date.now().toString(),
                      type: 'geofence_breach',
                      busNo: driverBusNo || 'BUS',
                      timestamp: Date.now()
                    });
                    await AsyncStorage.setItem('@raasta_demo_events', JSON.stringify(demoEvents));
                    Alert.alert('GEOFENCE BREACH', 'Simulated bus leaving the pre-determined route. Alerting school.');
                  } catch (e) {}
                }}
                variant="outline"
                style={{ flex: 1, borderColor: colors.danger }}
                labelStyle={{ color: colors.danger, fontSize: 12 }}
              />
            </View>
            <Text style={[typography.caption, { color: colors.danger, textAlign: 'center', marginTop: 12, fontFamily: 'Poppins-Medium' }]}>
              🚨 SOS broadcast to school, parents and RTO
            </Text>
          </AppCard>
        </Animated.View>
      ) : null}

      {recentAlerts.length > 0 ? (
        <>
          <SectionTitle title="Trip Alerts" />
          {recentAlerts.map((event) => (
            <AlertListItem key={event.id} event={event} />
          ))}
        </>
      ) : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 12 },
  speedCard: { flex: 1.2, justifyContent: 'center' },
  scoreCard: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1.6 },
  sosButton: { flex: 1 },
  sosRow: { flexDirection: 'row', alignItems: 'center' },
  pickupRow: { flexDirection: 'row', alignItems: 'center' },
  pickupIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DriverHomeScreen;
