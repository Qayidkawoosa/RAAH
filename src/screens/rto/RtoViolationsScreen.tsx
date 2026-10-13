import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FileWarning, ShieldAlert } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppCard } from '../../components/ui/AppCard';
import { Badge } from '../../components/ui/Badge';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { RankingRow } from '../../components/RankingRow';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { tripService } from '../../services/tripService';
import { DriverRanking, ViolationRecord } from '../../types/fleet';

const RtoViolationsScreen: React.FC = () => {
  const { colors, spacing } = useAppTheme();
  const [violations, setViolations] = useState<ViolationRecord[] | null>(null);
  const [rankings, setRankings] = useState<DriverRanking[] | null>(null);

  const load = useCallback(async (): Promise<void> => {
    await Promise.allSettled([
      tripService.getViolations().then(setViolations).catch(() => setViolations([])),
      tripService.getRankings().then(setRankings).catch(() => setRankings([])),
    ]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScreenContainer onRefresh={load}>
      <ScreenHeader title="Violations" subtitle="Detected automatically from trip telemetry" showBrand />

      {violations === null ? (
        [0, 1, 2].map((i) => <Skeleton key={i} height={92} style={{ marginBottom: 10 }} />)
      ) : violations.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No violations" message="Overspeed, deviation and compliance violations will be listed here." />
      ) : (
        violations.map((violation) => (
          <AppCard key={violation.id} style={{ marginBottom: spacing.sm }}>
            <View style={styles.row}>
              <View style={[styles.icon, { backgroundColor: `${colors.warning}1A` }]}>
                <FileWarning size={16} color={colors.warning} />
              </View>
              <View style={styles.body}>
                <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                  {violation.type} · {violation.busNo}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  {violation.detail}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                  {violation.driverName} · {violation.date}
                </Text>
              </View>
              <Badge
                label={violation.severity.toUpperCase()}
                tone={violation.severity === 'high' ? 'danger' : violation.severity === 'medium' ? 'warning' : 'neutral'}
              />
            </View>
          </AppCard>
        ))
      )}

      <SectionTitle title="Driver Rankings" />
      {rankings === null
        ? [0, 1].map((i) => <Skeleton key={i} height={72} style={{ marginBottom: 10 }} />)
        : rankings.map((ranking, index) => (
            <RankingRow key={ranking.driverId} ranking={ranking} position={index + 1} />
          ))}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  icon: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: 10 },
});

export default RtoViolationsScreen;
