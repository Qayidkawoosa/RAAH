import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Bus, GraduationCap, Minus, Route, Siren, TrendingDown, TrendingUp, AlertTriangle, ShieldAlert } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppCard } from '../../components/ui/AppCard';
import { StatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { Skeleton } from '../../components/ui/Skeleton';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { AiInsightCard } from '../../components/AiInsightCard';
import { LiveMap } from '../../components/LiveMap';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { tripService } from '../../services/tripService';
import { aiService } from '../../services/aiService';
import { AnalyticsSummary, FleetBus, Student, SafetyEvent } from '../../types/fleet';
import { WeeklyInsight } from '../../types/ai';
import { useBusTracking } from '../../hooks/useBusTracking';
import { DEMO_BUS_NO, ALL_ROUTES } from '../../constants/demoRoute';
import { AppStackParamList } from '../../navigation/types';
import { busStatusBadge } from '../../utils/busStatus';
import { BusMap } from '../../components/BusMap';
import { useBusLocations, BusStatus, BusLocation } from '../../hooks/useBusLocations';
import { dmsTelemetryBus } from '../../services/dms/dmsTelemetryBus';
import { realtimeService } from '../../services/realtime';

const playSafetyChime = () => {
  try {
    if (typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    }
  } catch (err) {
    // Audio context may require user gesture on web
  }
};

const SchoolDashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { colors, spacing } = useAppTheme();
  const [fleet, setFleet] = useState<FleetBus[] | null>(null);
  const [students, setStudents] = useState<Student[] | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [insights, setInsights] = useState<WeeklyInsight[] | null>(null);
  const [selectedBusNo, setSelectedBusNo] = useState(DEMO_BUS_NO);
  const { bus: liveBus, events } = useBusTracking(selectedBusNo);
  const { locations } = useBusLocations();
  
  const [statusFilter, setStatusFilter] = useState<'all' | BusStatus>('all');
  const [selectedFleetBus, setSelectedFleetBus] = useState<BusLocation | null>(null);
  const [liveDmsAlert, setLiveDmsAlert] = useState<SafetyEvent | null>(null);
  const [pendingIncidentCount, setPendingIncidentCount] = useState<number>(2);

  // Each section loads on its own — one slow or failed request never blanks
  // the rest of the dashboard.
  const load = useCallback(async (): Promise<void> => {
    await Promise.allSettled([
      tripService.getFleet().then(setFleet).catch(() => setFleet([])),
      tripService.getStudents().then(setStudents).catch(() => setStudents([])),
      tripService.getAnalytics().then(setAnalytics).catch(() => setAnalytics(null)),
      aiService.getWeeklyInsights().then(setInsights).catch(() => setInsights([])),
    ]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
                Alert.alert('⚠️ CRITICAL ALERT', `Parent reported ${evt.studentName} is MISSING at ${evt.stopName}!`);
              } else if (evt.type === 'dropped') {
                Alert.alert('Drop-off Confirmed', `Parent confirmed ${evt.studentName} was dropped off at ${evt.stopName}.`);
              } else if (evt.type === 'geofence_breach') {
                Alert.alert('⚠️ GEOFENCE ALERT', `Bus ${evt.busNo} has left the authorized predetermined route!`);
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

  // Real-Time DMS Telemetry Bus & Socket.IO Alert Subscription
  useEffect(() => {
    let isMounted = true;
    let lastHandledEventId = '';

    // Load initial persisted pending incidents
    tripService.getSafetyEvents().then((events) => {
      if (isMounted && events) {
        const pending = events.filter((e) => e.status === 'auto_flagged' || e.status === 'under_review');
        if (pending.length > 0) setPendingIncidentCount(pending.length);
      }
    });

    const handleIncomingAlert = (rawEvt: any) => {
      if (!isMounted || !rawEvt) return;
      const eventId = rawEvt.event_id || rawEvt.id || `evt_${Date.now()}`;
      if (eventId === lastHandledEventId) return;
      lastHandledEventId = eventId;

      const busNo = rawEvt.busNo || rawEvt.bus_id || 'JK-01-A-1234';
      const violationType = (rawEvt.type || rawEvt.violationType || 'drowsiness').toLowerCase();
      const severity = (rawEvt.severity || 'critical').toLowerCase();

      const event: SafetyEvent = {
        event_id: eventId,
        trip_id: rawEvt.tripId || rawEvt.trip_id || 'trip_live',
        bus_id: busNo,
        driver_id: rawEvt.driverId || rawEvt.driver_id || 'DRV-101',
        school_id: rawEvt.schoolId || rawEvt.school_id || 'SCH-01',
        source: rawEvt.source || 'driver_cam',
        type: violationType as any,
        severity: severity as any,
        confidence: typeof rawEvt.confidence === 'number' ? rawEvt.confidence : 0.95,
        status: rawEvt.status || 'auto_flagged',
        detected_at: rawEvt.detected_at || (rawEvt.timestamp ? new Date(rawEvt.timestamp).toISOString() : new Date().toISOString()),
        lat: rawEvt.latitude ?? rawEvt.lat ?? 34.0837,
        lng: rawEvt.longitude ?? rawEvt.lng ?? 74.7973,
        speed_kmph: rawEvt.speedKmh ?? rawEvt.speed_kmph ?? rawEvt.speed ?? 0,
        duration_ms: rawEvt.duration_ms ?? 3000,
        clip_ref: rawEvt.clip_ref ?? null,
        thumbnail_ref: rawEvt.snapshotUrl ?? rawEvt.thumbnail_ref ?? null,
        reviewed_by: rawEvt.reviewed_by ?? null,
        reviewed_at: rawEvt.reviewed_at ?? null,
        review_note: rawEvt.message ?? rawEvt.review_note ?? `Anomaly detected on bus ${busNo}`,
      };

      setLiveDmsAlert(event);
      playSafetyChime();
      setPendingIncidentCount((prev) => prev + 1);
    };

    // 1. Subscribe to local/cross-tab telemetry bus
    const unsubscribeBus = dmsTelemetryBus.subscribeToSafetyEvents(handleIncomingAlert);

    // 2. Ensure Socket.IO is listening to server-side alerts from any vehicle/phone
    let socket: any = null;
    try {
      socket = (realtimeService as any).ensureSocket?.();
      if (socket) {
        socket.on('bus:event', handleIncomingAlert);
        socket.on('dms:alert:broadcast', handleIncomingAlert);
      }
    } catch (err) {
      console.warn('[SchoolDashboard] Failed to bind Socket.IO listeners:', err);
    }

    return () => {
      isMounted = false;
      unsubscribeBus();
      if (socket) {
        socket.off('bus:event', handleIncomingAlert);
        socket.off('dms:alert:broadcast', handleIncomingAlert);
      }
    };
  }, []);

  const trendIcon = { up: TrendingUp, down: TrendingDown, flat: Minus };
  const hasSos = events.some((event) => event.type === 'sos');

  const filteredLocations = Object.values(locations).filter(loc => 
    statusFilter === 'all' ? true : loc.status === statusFilter
  );

  const routeConfig = ALL_ROUTES.find((r) => r.busNo === selectedBusNo) ?? ALL_ROUTES[0];

  return (
    <ScreenContainer onRefresh={load}>
      <ScreenHeader title="Fleet Monitor" subtitle={user?.schoolName ?? 'School Transport'} showLogout showBrand />

      {hasSos ? (
        <AppCard accent="danger" style={{ marginBottom: spacing.md }}>
          <View style={styles.sosRow}>
            <Siren size={18} color={colors.danger} />
            <Text style={[typography.titleMedium, { color: colors.danger, marginLeft: 8 }]}>
              ACTIVE SOS — {selectedBusNo}
            </Text>
          </View>
        </AppCard>
      ) : null}

      {/* Real-Time Live DMS Anomaly Red Alert Banner */}
      {liveDmsAlert ? (
        <Animated.View entering={FadeInDown.duration(300)}>
          <AppCard
            accent="danger"
            style={{
              marginBottom: spacing.md,
              borderColor: colors.danger,
              borderWidth: 2,
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, paddingRight: 8 }}>
                <AlertTriangle size={18} color={colors.danger} />
                <Text
                  style={[
                    typography.titleMedium,
                    { color: colors.danger, fontWeight: '800' },
                  ]}
                  numberOfLines={2}
                >
                  {`DMS SAFETY ANOMALY DETECTED: ${liveDmsAlert.bus_id || (liveDmsAlert as any).busNo || 'JK-01-A-1234'} - ${(liveDmsAlert.type || (liveDmsAlert as any).violationType || 'SAFETY ANOMALY').toUpperCase().replace('_', ' ')}`}
                </Text>
              </View>
              <Badge
                label={liveDmsAlert.severity.toUpperCase()}
                tone={liveDmsAlert.severity === 'critical' ? 'danger' : 'warning'}
              />
            </View>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginVertical: 4, fontWeight: '600' }]}>
              {liveDmsAlert.review_note || `Driver anomaly detected on ${liveDmsAlert.source}. Confidence: ${(liveDmsAlert.confidence * 100).toFixed(0)}%`}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 6 }]}>
              Detected at {new Date(liveDmsAlert.detected_at).toLocaleTimeString()} · Driver ID: {liveDmsAlert.driver_id}
            </Text>

            {/* Live Camera Snapshot Preview */}
            {liveDmsAlert.thumbnail_ref ? (
              <View style={{ height: 140, borderRadius: 8, overflow: 'hidden', marginVertical: 6, backgroundColor: '#000', borderWidth: 1, borderColor: colors.border }}>
                <Image
                  source={{ uri: liveDmsAlert.thumbnail_ref }}
                  style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                />
                <View style={{ position: 'absolute', bottom: 6, right: 8, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>ANOMALY SNAPSHOT</Text>
                </View>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <PrimaryButton
                label="Review Incident"
                variant="gradient"
                onPress={() => navigation.navigate('SchoolIncidentReview')}
                style={{ flex: 1, height: 36, paddingVertical: 0 }}
              />
              <PrimaryButton
                label="Dismiss"
                variant="outline"
                onPress={() => setLiveDmsAlert(null)}
                style={{ width: 90, height: 36, paddingVertical: 0 }}
              />
            </View>
          </AppCard>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(400)}>
        <View style={{ height: 260, borderRadius: 12, overflow: 'hidden' }}>
          <BusMap
            busLocations={filteredLocations}
            routeCoordinatesList={ALL_ROUTES.map(r => r.path.map(p => ({ latitude: p.latitude, longitude: p.longitude })))}
            onBusPress={(bus) => setSelectedFleetBus(bus)}
          />
        </View>

        <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
          {(['all', 'on_route', 'delayed', 'sos'] as const).map(filter => (
            <TouchableOpacity
              key={filter}
              onPress={() => setStatusFilter(filter as any)}
              style={{
                paddingHorizontal: 12, paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: statusFilter === filter ? colors.primary : colors.card,
                borderWidth: 1, borderColor: statusFilter === filter ? colors.primary : colors.border
              }}
            >
              <Text style={[typography.caption, { color: statusFilter === filter ? '#FFF' : colors.textPrimary }]}>
                {filter.toUpperCase().replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedFleetBus && (
          <AppCard style={{ marginTop: 12, padding: 12, borderColor: colors.primary, borderWidth: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{selectedFleetBus.busId}</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Next: {selectedFleetBus.nextStopName} ({selectedFleetBus.etaMinutes}m)</Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>{Math.round(selectedFleetBus.speedKmh)} km/h · Students: 32/40</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <TouchableOpacity onPress={() => setSelectedFleetBus(null)} style={{ padding: 4 }}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>✕ Close</Text>
                </TouchableOpacity>
                <Badge label={selectedFleetBus.status} tone={selectedFleetBus.status === 'sos' ? 'danger' : selectedFleetBus.status === 'delayed' ? 'warning' : 'success'} />
              </View>
            </View>
          </AppCard>
        )}
      </Animated.View>

      <View style={{ marginTop: spacing.md }}>
        {analytics && fleet && students ? (
          <>
            <Animated.View entering={FadeInDown.duration(400)} style={styles.statsRow}>
              <StatCard label="Buses" value={String(fleet.length)} icon={Bus} />
              <StatCard label="Live Occupancy" value="32 / 40" icon={GraduationCap} tint={colors.secondaryAccent} />
              <StatCard label="Trips Active" value={String(analytics.activeTrips)} icon={Route} tint={colors.warning} />
            </Animated.View>
            
            <Animated.View entering={FadeInDown.delay(100).duration(400)} style={{ marginTop: spacing.md }}>
              <AppCard accent="default" style={{ padding: 12, borderColor: colors.warning, borderWidth: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[typography.titleMedium, { color: colors.warning }]}>Incident Review Queue</Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      {pendingIncidentCount} safety {pendingIncidentCount === 1 ? 'event' : 'events'} pending human review
                    </Text>
                  </View>
                  <PrimaryButton 
                    label="Review Now" 
                    onPress={() => navigation.navigate('SchoolIncidentReview')}
                    variant="gradient"
                    style={{ minWidth: 100, height: 36, paddingVertical: 0 }}
                  />
                </View>
              </AppCard>
            </Animated.View>
          </>
        ) : (
          <Skeleton height={104} />
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 }}>
        <SectionTitle title="Live Fleet" />
        <TouchableOpacity onPress={() => navigation.navigate('SchoolFleetManagement')}>
          <Text style={[typography.bodyMedium, { color: colors.primary, fontFamily: 'Poppins-Medium' }]}>Manage</Text>
        </TouchableOpacity>
      </View>
      {fleet === null ? (
        [0, 1, 2].map((i) => <Skeleton key={i} height={74} style={{ marginBottom: 10 }} />)
      ) : (
        fleet.map((busItem, index) => {
          const isCurrentlySelected = busItem.busNo === selectedBusNo;
          const isTracked = isCurrentlySelected && liveBus !== null;
          const status = isTracked ? liveBus.status : busItem.status;
          return (
            <Animated.View key={busItem.busNo} entering={FadeInDown.delay(index * 50).duration(350)}>
              <TouchableOpacity
                onPress={() => setSelectedBusNo(busItem.busNo)}
                activeOpacity={0.7}
              >
                <AppCard
                  style={{
                    ...styles.busRow,
                    ...(isCurrentlySelected ? {
                      borderColor: colors.primary,
                      borderWidth: 2,
                    } : {}),
                  }}
                >
                  <Bus size={18} color={isCurrentlySelected ? colors.primary : colors.textSecondary} />
                  <View style={styles.busBody}>
                    <Text style={[typography.titleMedium, { color: colors.textPrimary, fontFamily: isCurrentlySelected ? 'Poppins-SemiBold' : 'Poppins-Medium' }]}>{busItem.busNo}</Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
                      {busItem.driverName} · {isTracked ? `${Math.round(liveBus.speedKmh)} km/h · ETA ${liveBus.etaMinutes}m` : busItem.routeName}
                    </Text>
                  </View>
                  <Badge {...busStatusBadge(status, 'school')} />
                </AppCard>
              </TouchableOpacity>
            </Animated.View>
          );
        })
      )}

      <SectionTitle title="AI Weekly Insights" />
      {insights === null ? (
        <Skeleton height={160} />
      ) : (
        insights.map((insight) => {
          const Trend = trendIcon[insight.trend] ?? Minus;
          return (
            <AiInsightCard key={insight.title} title={insight.title}>
              <View style={styles.insightRow}>
                <Trend size={15} color={insight.trend === 'up' ? colors.success : insight.trend === 'down' ? colors.danger : colors.textSecondary} />
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: 8, flex: 1 }]}>
                  {insight.detail}
                </Text>
              </View>
            </AiInsightCard>
          );
        })
      )}

      <SectionTitle title="Student Invite Codes" />
      {students === null ? (
        <Skeleton height={100} />
      ) : (
        students.map((student) => {
          const displayCode = student.id.toUpperCase().replace('_', '-');
          const isLinked = student.parentName && student.parentName.trim().length > 0;
          return (
            <AppCard key={student.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{student.name}</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    {student.className} · Bus: {student.busNo}
                  </Text>
                  {isLinked ? (
                    <Text style={[typography.caption, { color: colors.success, marginTop: 4, fontFamily: 'Poppins-Medium' }]}>
                      ✓ Parent linked: {student.parentName}
                    </Text>
                  ) : (
                    <Text style={[typography.caption, { color: colors.warning, marginTop: 4, fontFamily: 'Poppins-Medium' }]}>
                      ⌛ Awaiting parent linkage
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 2 }]}>Invite Code</Text>
                  <Badge label={displayCode} tone="info" />
                </View>
              </View>
            </AppCard>
          );
        })
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 12 },
  sosRow: { flexDirection: 'row', alignItems: 'center' },
  busRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  busBody: { flex: 1, paddingHorizontal: 12 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start' },
});

export default SchoolDashboardScreen;
