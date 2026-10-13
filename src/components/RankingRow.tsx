import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { DriverRanking } from '../types/fleet';
import { AppCard } from './ui/AppCard';
import { useAppTheme } from '../hooks/useAppTheme';
import { typography } from '../theme/typography';

interface RankingRowProps {
  ranking: DriverRanking;
  position: number;
}

export const RankingRow: React.FC<RankingRowProps> = ({ ranking, position }) => {
  const { colors } = useAppTheme();
  const scoreColor =
    ranking.safetyScore >= 85 ? colors.success : ranking.safetyScore >= 65 ? colors.warning : colors.danger;
  const TrendIcon =
    ranking.trend === 'up' ? TrendingUp : ranking.trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    ranking.trend === 'up' ? colors.success : ranking.trend === 'down' ? colors.danger : colors.textSecondary;

  // Top 3 positions get the purple accent badge
  const isTopThree = position <= 3;

  return (
    <AppCard style={styles.card}>
      <View style={[styles.rank, { backgroundColor: isTopThree ? colors.primary : colors.surface }]}>
        <Text style={[typography.titleMedium, { color: isTopThree ? '#FFFFFF' : colors.textPrimary }]}>{position}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[typography.titleMedium, { color: colors.textPrimary }]} numberOfLines={1}>
          {ranking.driverName}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
          {ranking.busNo} · {ranking.tripsCompleted} trips · {ranking.violations} violations
        </Text>
      </View>
      <TrendIcon size={16} color={trendColor} style={styles.trend} />
      <Text style={[typography.h3, { color: scoreColor }]}>{ranking.safetyScore}</Text>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rank: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, paddingHorizontal: 12 },
  trend: { marginRight: 10 },
});
