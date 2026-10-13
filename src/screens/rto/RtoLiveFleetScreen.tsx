import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bus, ChevronRight, GraduationCap, MapPin } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppCard } from '../../components/ui/AppCard';
import { StatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { Skeleton } from '../../components/ui/Skeleton';
import { LiveMap } from '../../components/LiveMap';
import { useBusTracking } from '../../hooks/useBusTracking';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { tripService } from '../../services/tripService';
import { FleetBus, Student } from '../../types/fleet';
import { ScheduleBanner } from '../../components/ScheduleBanner';
import { ALL_ROUTES, DEMO_BUS_NO } from '../../constants/demoRoute';
import { AppStackParamList } from '../../navigation/types';
import { busStatusBadge } from '../../utils/busStatus';
import { formatSpeed } from '../../utils/format';
import { BusMap } from '../../components/BusMap';
import { useBusLocations, BusLocation } from '../../hooks/useBusLocations';

const SCHOOL_COLORS: Record<string, string> = {
  'Kashmir Valley School': '#8B5CF6',
  'Burn Hall School': '#3B82F6',
  'Presentation Convent': '#EC4899',
  'default': '#6B7280'
};

type Navigation = NativeStackNavigationProp<AppStackParamList>;

/** RTO-wide view: every bus, where it is, and whether it is on schedule. */
const RtoLiveFleetScreen: React.FC = () => {
  const { colors, spacing } = useAppTheme();
  const navigation = useNavigation<Navigation>();
  const { bus: liveBus } = useBusTracking(DEMO_BUS_NO);
  const [fleet, setFleet] = useState<FleetBus[] | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const { locations } = useBusLocations();
  const [schoolFilter, setSchoolFilter] = useState<string>('All');
  const [selectedRtoBus, setSelectedRtoBus] = useState<BusLocation | null>(null);

  const load = useCallback(async (): Promise<void> => {
    await Promise.all([
      tripService.getFleet().then(setFleet).catch(() => setFleet([])),
      tripService.getStudents().then(setStudents).catch(() => setStudents([])),
    ]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const runningCount = liveBus?.status === 'active' ? 1 : 0;

  // One pass over students and routes instead of a scan per rendered row.
  const studentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    students.forEach((student) => {
      counts.set(student.busNo, (counts.get(student.busNo) ?? 0) + 1);
    });
    return counts;
  }, [students]);

  const routeNames = useMemo(
    () => new Map(ALL_ROUTES.map((route) => [route.busNo, route.routeName])),
    []
  );

  const uniqueSchools = useMemo(() => {
    const schools = new Set<string>();
    Object.values(locations).forEach(loc => loc.schoolName && schools.add(loc.schoolName));
    return ['All', ...Array.from(schools)];
  }, [locations]);

  const filteredLocations = Object.values(locations).filter(loc => 
    schoolFilter === 'All' ? true : loc.schoolName === schoolFilter
  );

  const getPinColor = (bus: BusLocation) => {
    if (bus.status === 'sos') return '#EF4444';
    if (bus.status === 'delayed' || bus.speedKmh > 40) return '#F59E0B';
    return bus.schoolName ? (SCHOOL_COLORS[bus.schoolName] || SCHOOL_COLORS.default) : SCHOOL_COLORS.default;
  };

  return (
    <ScreenContainer onRefresh={load}>
      <ScreenHeader title="Live Fleet" subtitle="Every registered bus across the district" showBrand />

      <ScheduleBanner audience="school" style={{ marginBottom: spacing.md }} />

      <View style={{ height: 260, borderRadius: 12, overflow: 'hidden' }}>
        <BusMap
          busLocations={filteredLocations}
          routeCoordinatesList={ALL_ROUTES.map(r => r.path.map(p => ({ latitude: p.latitude, longitude: p.longitude })))}
          onBusPress={(bus) => setSelectedRtoBus(bus)}
          getPinColor={getPinColor}
        />
      </View>

      <View style={{ flexDirection: 'row', marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
        {uniqueSchools.map(school => (
          <TouchableOpacity
            key={school}
            onPress={() => setSchoolFilter(school)}
            style={{
              paddingHorizontal: 12, paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: schoolFilter === school ? colors.primary : colors.card,
              borderWidth: 1, borderColor: schoolFilter === school ? colors.primary : colors.border
            }}
          >
            <Text style={[typography.caption, { color: schoolFilter === school ? '#FFF' : colors.textPrimary }]}>
              {school}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedRtoBus && (
        <AppCard style={{ marginTop: 12, padding: 12, borderColor: colors.primary, borderWidth: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{selectedRtoBus.busId}</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontFamily: 'Poppins-SemiBold' }]}>{selectedRtoBus.schoolName}</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Driver: {selectedRtoBus.driverName}</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Compliance: {selectedRtoBus.complianceStatus}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                Next: {selectedRtoBus.nextStopName} ({selectedRtoBus.etaMinutes}m) · {Math.round(selectedRtoBus.speedKmh)} km/h
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
              <TouchableOpacity onPress={() => setSelectedRtoBus(null)} style={{ padding: 4 }}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>✕ Close</Text>
              </TouchableOpacity>
              <Badge label={selectedRtoBus.status} tone={selectedRtoBus.status === 'sos' ? 'danger' : selectedRtoBus.status === 'delayed' ? 'warning' : 'success'} />
            </View>
          </View>
        </AppCard>
      )}

      <View style={[styles.statsRow, { marginTop: spacing.md }]}>
        <StatCard label="Registered" value={fleet ? String(fleet.length) : '—'} icon={Bus} />
        <StatCard label="Running now" value={String(runningCount)} icon={MapPin} tint={colors.secondaryAccent} />
        <StatCard label="Students" value={String(students.length)} icon={GraduationCap} tint={colors.warning} />
      </View>

      <SectionTitle title="All Buses" />
      {fleet === null
        ? [0, 1, 2].map((index) => <Skeleton key={index} height={78} style={{ marginBottom: 10 }} />)
        : fleet.map((item) => {
            const isLive = item.busNo === DEMO_BUS_NO && liveBus !== null;
            const badge = busStatusBadge(isLive ? liveBus.status : 'idle', 'rto');
            return (
              <TouchableOpacity
                key={item.busNo}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Track ${item.busNo}`}
                onPress={() => navigation.navigate('FullMap', { busNo: item.busNo })}
              >
                <AppCard style={styles.busRow}>
                  <Bus size={18} color={isLive ? colors.primary : colors.textSecondary} />
                  <View style={styles.busInfo}>
                    <Text style={[typography.titleMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                      {item.busNo}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
                      {routeNames.get(item.busNo) ?? 'Route not assigned'}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                      {item.driverName} · {studentCounts.get(item.busNo) ?? 0} students
                      {isLive ? ` · ${formatSpeed(liveBus.speedKmh)} · next ${liveBus.nextStop}` : ''}
                    </Text>
                  </View>
                  <View style={styles.busEnd}>
                    <Badge label={badge.label} tone={badge.tone} />
                    <ChevronRight size={16} color={colors.textSecondary} />
                  </View>
                </AppCard>
              </TouchableOpacity>
            );
          })}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 12 },
  busRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  busInfo: { flex: 1, paddingHorizontal: 12 },
  busEnd: { alignItems: 'flex-end', gap: 6 },
});

export default RtoLiveFleetScreen;
