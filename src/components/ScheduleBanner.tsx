import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock } from 'lucide-react-native';
import { AppCard } from './ui/AppCard';
import { Badge } from './ui/Badge';
import { useScheduleWindow } from '../hooks/useScheduleWindow';
import { formatScheduleTime, formatTimeUntil } from '../constants/schedule';
import { useAppTheme } from '../hooks/useAppTheme';
import { typography } from '../theme/typography';

type Audience = 'driver' | 'school' | 'parent';

interface ScheduleBannerProps {
  audience: Audience;
  style?: React.ComponentProps<typeof AppCard>['style'];
}

/** Wording per role for the same underlying timetable state. */
const copy: Record<Audience, { open: string; openBadge: string; idleBadge: string }> = {
  driver: {
    open: 'window is open — tracking starts automatically',
    openBadge: 'On duty',
    idleBadge: 'Waiting',
  },
  school: {
    open: 'is in progress across the fleet',
    openBadge: 'Active window',
    idleBadge: 'Off duty',
  },
  parent: {
    open: 'window is open — tracking starts when the driver sets off',
    openBadge: 'Due now',
    idleBadge: 'Scheduled',
  },
};

/** Shared "on duty / next trip" card driven by the shared schedule clock. */
export const ScheduleBanner: React.FC<ScheduleBannerProps> = ({ audience, style }) => {
  const { colors } = useAppTheme();
  const { inWindow, upcoming, now } = useScheduleWindow();
  const words = copy[audience];

  const title = inWindow ? `${inWindow.name} ${words.open}` : `Next trip: ${upcoming.schedule.name}`;
  const subtitle = inWindow
    ? `Scheduled ${formatScheduleTime(inWindow, now)}`
    : `${formatScheduleTime(upcoming.schedule, now)} · ${formatTimeUntil(upcoming.startsAt, now)}`;

  return (
    <AppCard style={style} accent={inWindow ? 'purple' : 'default'}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: inWindow ? 'rgba(255,255,255,0.18)' : `${colors.primary}1A` }]}>
          <Clock size={17} color={inWindow ? '#FFFFFF' : colors.primary} />
        </View>
        <View style={styles.text}>
          <Text style={[typography.titleMedium, { color: inWindow ? '#FFFFFF' : colors.textPrimary }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[typography.bodySmall, { color: inWindow ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Badge
          label={inWindow ? words.openBadge : words.idleBadge}
          tone={inWindow ? 'success' : 'neutral'}
        />
      </View>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, paddingHorizontal: 10 },
});
