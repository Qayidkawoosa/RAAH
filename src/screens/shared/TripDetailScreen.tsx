import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Gauge, MapPin, ShieldCheck, Timer } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { StatCard } from '../../components/ui/StatCard';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertListItem } from '../../components/AlertListItem';
import { LiveMap } from '../../components/LiveMap';
import { SafetyScoreRing } from '../../components/SafetyScoreRing';
import { AiInsightCard } from '../../components/AiInsightCard';
import { AppStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { formatDate, formatDuration, formatSpeed } from '../../utils/format';
import { ALL_ROUTES } from '../../constants/demoRoute';

type DetailRoute = RouteProp<AppStackParamList, 'TripDetail'>;

const TripDetailScreen: React.FC = () => {
  const { params } = useRoute<DetailRoute>();
  const { colors, spacing } = useAppTheme();
  const { trip } = params;
  const alerts = trip.events.filter((e) => e.type !== 'trip_started' && e.type !== 'trip_ended');
  const lastPoint = trip.path[trip.path.length - 1] ?? null;

  const routeConfig = ALL_ROUTES.find((r) => r.busNo === trip.busNo) ?? ALL_ROUTES[0];

  return (
    <ScreenContainer>
      <ScreenHeader title="Trip Detail" subtitle={`${trip.routeName} · ${formatDate(trip.startedAt)}`} showBrand />

      <View style={styles.headerRow}>
        <SafetyScoreRing score={trip.safetyScore} size={110} />
        <View style={styles.headerText}>
          <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{trip.driverName}</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
            {trip.busNo}
          </Text>
        </View>
      </View>

      <View style={[styles.statsRow, { marginTop: spacing.lg }]}>
        <StatCard label="Duration" value={formatDuration((trip.endedAt ?? trip.startedAt) - trip.startedAt)} icon={Timer} />
        <StatCard label="Distance" value={`${trip.distanceKm.toFixed(1)} km`} icon={MapPin} tint={colors.secondaryAccent} />
        <StatCard label="Max Speed" value={formatSpeed(trip.maxSpeedKmh)} icon={Gauge} tint={colors.warning} />
      </View>

      <SectionTitle title="Route" />
      <LiveMap
        busLocation={lastPoint}
        height={220}
        followBus={false}
        routePath={routeConfig.path}
        stops={routeConfig.stops}
      />

      {trip.aiSummary && trip.aiReport ? (
        <>
          <SectionTitle title="AI Performance Review" />
          <AiInsightCard title="AI Trip Summary">
            <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{trip.aiSummary.headline}</Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 6 }]}>
              {trip.aiSummary.summary}
            </Text>
          </AiInsightCard>
          <AiInsightCard title="AI Safety Assessment">
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{trip.aiReport.headline}</Text>
            {trip.aiReport.risks.map((risk) => (
              <Text key={risk} style={[typography.bodySmall, { color: colors.danger, marginTop: 6 }]}>
                ▲ {risk}
              </Text>
            ))}
            {trip.aiReport.strengths.map((strength) => (
              <Text key={strength} style={[typography.bodySmall, { color: colors.success, marginTop: 6 }]}>
                ✓ {strength}
              </Text>
            ))}
          </AiInsightCard>
        </>
      ) : null}

      <SectionTitle title={`Safety Events (${alerts.length})`} />
      {alerts.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Clean trip" message="No overspeeding, long stops or route deviations were detected." />
      ) : (
        alerts.map((event) => <AlertListItem key={event.id} event={event} />)
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  headerText: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: 12 },
});

export default TripDetailScreen;
