import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, Route } from 'lucide-react-native';
import { Trip } from '../types/trip';
import { AppCard } from './ui/AppCard';
import { Badge } from './ui/Badge';
import { useAppTheme } from '../hooks/useAppTheme';
import { typography } from '../theme/typography';
import { formatDate, formatDuration, formatKm } from '../utils/format';

interface TripCardProps {
  trip: Trip;
  onPress: (trip: Trip) => void;
}

export const TripCard: React.FC<TripCardProps> = ({ trip, onPress }) => {
  const { colors } = useAppTheme();
  const violations = trip.events.filter(
    (event) => event.type !== 'trip_started' && event.type !== 'trip_ended'
  ).length;

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => onPress(trip)}>
      <AppCard style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}1A` }]}>
          <Route size={18} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={styles.body}>
          <Text style={[typography.titleMedium, { color: colors.textPrimary }]} numberOfLines={1}>
            {trip.routeName}
          </Text>
          <Text
            style={[typography.bodySmall, { color: colors.textSecondary, marginVertical: 3 }]}
            numberOfLines={1}
          >
            {formatDate(trip.startedAt)} · {formatDuration((trip.endedAt ?? trip.startedAt) - trip.startedAt)} · {formatKm(trip.distanceKm)}
          </Text>
          <View style={styles.badges}>
            <Badge label={`Score ${trip.safetyScore}`} tone={trip.safetyScore >= 85 ? 'success' : trip.safetyScore >= 65 ? 'warning' : 'danger'} />
            {violations > 0 ? <Badge label={`${violations} alert${violations > 1 ? 's' : ''}`} tone="danger" /> : null}
          </View>
        </View>
        <ChevronRight size={18} color={colors.textSecondary} />
      </AppCard>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, paddingHorizontal: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
