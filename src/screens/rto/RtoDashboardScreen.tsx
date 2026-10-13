import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BadgeCheck, Bus, School, ShieldAlert } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppCard } from '../../components/ui/AppCard';
import { StatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { Skeleton } from '../../components/ui/Skeleton';
import { LiveMap } from '../../components/LiveMap';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { tripService } from '../../services/tripService';
import { AnalyticsSummary, ComplianceRecord } from '../../types/fleet';
import { useBusTracking } from '../../hooks/useBusTracking';
import { DEMO_BUS_NO } from '../../constants/demoRoute';
import { AppStackParamList } from '../../navigation/types';

const RtoDashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { colors, spacing } = useAppTheme();
  const [records, setRecords] = useState<ComplianceRecord[] | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const { bus: liveBus } = useBusTracking(DEMO_BUS_NO);

  const load = useCallback(async (): Promise<void> => {
    await Promise.allSettled([
      tripService.getCompliance().then(setRecords).catch(() => setRecords([])),
      tripService.getAnalytics().then(setAnalytics).catch(() => setAnalytics(null)),
    ]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const schools = records
    ? [...new Set(records.map((record) => record.schoolName))].map((schoolName) => ({
        schoolName,
        buses: records.filter((record) => record.schoolName === schoolName),
      }))
    : null;

  return (
    <ScreenContainer onRefresh={load}>
      <ScreenHeader title="Transport Authority" subtitle={`RTO ${user?.rtoCode ?? 'JK-01'} · Srinagar`} showLogout showBrand />

      <Animated.View entering={FadeInDown.duration(400)}>
        <LiveMap
          busLocation={liveBus?.location ?? null}
          heading={liveBus?.heading ?? 0}
          height={210}
          onExpand={() => navigation.navigate('FullMap', { busNo: DEMO_BUS_NO })}
        />
        {liveBus ? (
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 6 }]} numberOfLines={1}>
            Live: {DEMO_BUS_NO} · {Math.round(liveBus.speedKmh)} km/h · next stop {liveBus.nextStop}
          </Text>
        ) : null}
      </Animated.View>

      <View style={{ marginTop: spacing.md }}>
        {analytics && records ? (
          <View style={styles.statsRow}>
            <StatCard label="Compliance" value={`${analytics.complianceRate}%`} icon={BadgeCheck} />
            <StatCard label="Registered Buses" value={String(records.length)} icon={Bus} tint={colors.secondaryAccent} />
            <StatCard label="Violations (7d)" value={String(analytics.totalViolationsWeek)} icon={ShieldAlert} tint={colors.warning} />
          </View>
        ) : (
          <Skeleton height={104} />
        )}
      </View>

      <SectionTitle title="Schools & Pickup Routes" />
      {schools === null
        ? [0, 1].map((i) => <Skeleton key={i} height={150} style={{ marginBottom: 10 }} />)
        : schools.map((school, index) => (
            <Animated.View key={school.schoolName} entering={FadeInDown.delay(index * 60).duration(350)}>
              <AppCard style={{ marginBottom: spacing.sm }}>
                <View style={styles.schoolHeader}>
                  <School size={16} color={colors.primary} />
                  <Text style={[typography.titleMedium, styles.schoolName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {school.schoolName}
                  </Text>
                  <Badge label={`${school.buses.length} bus${school.buses.length > 1 ? 'es' : ''}`} tone="info" />
                </View>
                {school.buses.map((record, busIndex) => {
                  const isLive = record.busNo === DEMO_BUS_NO && liveBus !== null;
                  return (
                    <View
                      key={record.busNo}
                      style={[
                        styles.busRow,
                        busIndex < school.buses.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border,
                        },
                      ]}
                    >
                      <View style={styles.busInfo}>
                        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{record.busNo}</Text>
                        <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
                          {record.routeName}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                          Insurance till {record.insuranceValidTill} · Inspected {record.lastInspection}
                        </Text>
                      </View>
                      <View style={styles.busBadges}>
                        <Badge label={isLive ? 'Live' : 'Idle'} tone={isLive ? 'success' : 'neutral'} />
                        {!record.isCompliant ? <Badge label="Action needed" tone="danger" /> : null}
                      </View>
                    </View>
                  );
                })}
              </AppCard>
            </Animated.View>
          ))}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 12 },
  schoolHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  schoolName: { flex: 1, marginLeft: 8, marginRight: 8 },
  busRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  busInfo: { flex: 1, paddingRight: 8 },
  busBadges: { alignItems: 'flex-end', gap: 4 },
});

export default RtoDashboardScreen;
