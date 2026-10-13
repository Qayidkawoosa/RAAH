import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Gauge, MapPinOff, Siren, Timer, LucideIcon, MapPin, Play, CheckCircle2 } from 'lucide-react-native';
import { TripEvent, TripEventType } from '../types/trip';
import { useAppTheme } from '../hooks/useAppTheme';
import { typography } from '../theme/typography';
import { timeAgo } from '../utils/format';

interface AlertListItemProps {
  event: TripEvent;
}

export const AlertListItem: React.FC<AlertListItemProps> = ({ event }) => {
  const { colors, roundness } = useAppTheme();

  const visuals: Record<TripEventType, { icon: LucideIcon; color: string; title: string }> = {
    overspeed: { icon: Gauge, color: colors.warning, title: 'Overspeeding' },
    long_stop: { icon: Timer, color: colors.secondaryAccent, title: 'Long Stop' },
    route_deviation: { icon: MapPinOff, color: colors.danger, title: 'Route Deviation' },
    sos: { icon: Siren, color: colors.danger, title: 'Emergency SOS' },
    trip_started: { icon: Play, color: colors.success, title: 'Trip Started' },
    trip_ended: { icon: CheckCircle2, color: colors.primary, title: 'Trip Ended' },
    student_pickup: { icon: MapPin, color: colors.primary, title: 'Student Pickup' },
    overcrowding: { icon: AlertTriangle, color: colors.warning, title: 'Overcrowding' },
    left_behind: { icon: AlertTriangle, color: colors.danger, title: 'Left Behind' },
  };
  const visual = visuals[event.type] ?? { icon: AlertTriangle, color: colors.textSecondary, title: 'Alert' };
  const { icon: Icon, color, title } = visual;

  return (
    <View style={[styles.row, { borderRadius: roundness.md, backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${color}1A` }]}>
        <Icon size={16} color={color} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <Text style={[typography.titleMedium, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text
          style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 1 }]}
          numberOfLines={2}
        >
          {event.message}
        </Text>
      </View>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>
        {timeAgo(event.timestamp)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, paddingHorizontal: 10 },
});
