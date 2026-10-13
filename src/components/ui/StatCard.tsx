import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { AppCard } from './AppCard';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tint?: string;
  /** Use the purple-filled card variant for featured stats */
  featured?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, tint, featured = false }) => {
  const { colors } = useAppTheme();
  const iconColor = featured ? '#FFFFFF' : (tint ?? colors.primary);
  const valueColor = featured ? '#FFFFFF' : colors.textPrimary;
  const labelColor = featured ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  const iconBg = featured ? 'rgba(255,255,255,0.18)' : `${iconColor}1A`;

  return (
    <AppCard style={styles.card} accent={featured ? 'purple' : 'default'}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Icon size={16} color={iconColor} strokeWidth={2} />
      </View>
      <Text
        style={[typography.statValue, { color: valueColor, marginTop: 10 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {value}
      </Text>
      <Text
        style={[typography.bodySmall, { color: labelColor, marginTop: 2 }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  card: { flex: 1 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
