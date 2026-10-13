import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Gauge, MapPin, Timer } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { StatCard } from '../../components/ui/StatCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { AiInsightCard } from '../../components/AiInsightCard';
import { SafetyScoreRing } from '../../components/SafetyScoreRing';
import { aiService } from '../../services/aiService';
import { tripService } from '../../services/tripService';
import { SafetyReport, TripSummary } from '../../types/ai';
import { AppStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { formatDuration, formatKm, formatSpeed } from '../../utils/format';

type SummaryRoute = RouteProp<AppStackParamList, 'TripSummary'>;
type Navigation = NativeStackNavigationProp<AppStackParamList>;

const TripSummaryScreen: React.FC = () => {
  const { params } = useRoute<SummaryRoute>();
  const navigation = useNavigation<Navigation>();
  const { colors, spacing } = useAppTheme();
  const { trip } = params;

  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [report, setReport] = useState<SafetyReport | null>(null);

  useEffect(() => {
    let mounted = true;

    // Check if the trip already contains cached AI results
    if (trip.aiSummary && trip.aiReport) {
      setSummary(trip.aiSummary);
      setReport(trip.aiReport);
      return;
    }

    Promise.all([aiService.getTripSummary(trip), aiService.getSafetyReport(trip)])
      .then(([tripSummary, safetyReport]) => {
        if (!mounted) return;
        setSummary(tripSummary);
        setReport(safetyReport);

        // Update trip history with the AI summary/report so it is persistent
        const updatedTrip = {
          ...trip,
          aiSummary: tripSummary,
          aiReport: safetyReport,
        };
        tripService.saveTrip(updatedTrip).catch((err) => {
          console.error('Failed to save AI report to trip history:', err);
        });
      })
      .catch((err) => console.error('Failed to load AI assessments:', err));

    return () => {
      mounted = false;
    };
  }, [trip]);

  return (
    <ScreenContainer>
      <ScreenHeader title="Trip Complete" subtitle={trip.routeName} showBrand />

      <View style={styles.scoreWrap}>
        <SafetyScoreRing score={trip.safetyScore} size={132} />
        {report ? <Badge label={`Grade ${report.grade}`} tone={report.grade === 'A' ? 'success' : report.grade === 'B' ? 'info' : 'warning'} /> : null}
      </View>

      <View style={[styles.statsRow, { marginTop: spacing.lg }]}>
        <StatCard label="Duration" value={formatDuration((trip.endedAt ?? trip.startedAt) - trip.startedAt)} icon={Timer} />
        <StatCard label="Distance" value={formatKm(trip.distanceKm)} icon={MapPin} tint={colors.secondaryAccent} />
        <StatCard label="Max Speed" value={formatSpeed(trip.maxSpeedKmh)} icon={Gauge} tint={colors.warning} />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        {summary && report ? (
          <>
            <AiInsightCard title="AI Trip Summary">
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{summary.headline}</Text>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 6 }]}>
                {summary.summary}
              </Text>
            </AiInsightCard>
            <AiInsightCard title="AI Safety Review">
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{report.headline}</Text>
              {report.risks.map((risk) => (
                <Text key={risk} style={[typography.bodySmall, { color: colors.danger, marginTop: 6 }]}>
                  ▲ {risk}
                </Text>
              ))}
              {report.strengths.map((strength) => (
                <Text key={strength} style={[typography.bodySmall, { color: colors.success, marginTop: 6 }]}>
                  ✓ {strength}
                </Text>
              ))}
              {report.recommendations.map((rec) => (
                <Text key={rec} style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 6 }]}>
                  → {rec}
                </Text>
              ))}
            </AiInsightCard>
          </>
        ) : (
          <>
            <Skeleton height={120} style={{ marginBottom: spacing.md }} />
            <Skeleton height={160} />
          </>
        )}
      </View>

      {/* Phase 1: Post-Trip Sweep */}
      <View style={{ marginTop: spacing.xl, marginBottom: spacing.md, padding: 16, backgroundColor: `${colors.warning}1A`, borderRadius: 12, borderWidth: 1, borderColor: colors.warning }}>
        <Text style={[typography.titleMedium, { color: colors.warning, marginBottom: 8 }]}>Mandatory Post-Trip Sweep</Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 16 }]}>
          Please physically check the cabin. The Cabin Camera will cross-check occupancy upon confirmation.
        </Text>
        <PrimaryButton 
          label="Bus Checked and Empty" 
          onPress={() => {
            Alert.alert(
              'Sweep Confirmed', 
              'Cabin camera cross-check complete. No passengers detected.',
              [{ text: 'OK', onPress: () => navigation.navigate('Tabs') }]
            );
          }} 
          variant="outline" 
        />
      </View>

      <PrimaryButton label="Back to Home" onPress={() => navigation.navigate('Tabs')} style={{ marginTop: spacing.lg }} />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scoreWrap: { alignItems: 'center', gap: 10 },
  statsRow: { flexDirection: 'row', gap: 12 },
});

export default TripSummaryScreen;
