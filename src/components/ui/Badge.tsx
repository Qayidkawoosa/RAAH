import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'ai' | 'neutral' | 'primary';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

export const Badge: React.FC<BadgeProps> = ({ label, tone = 'neutral' }) => {
  const { colors, isDark } = useAppTheme();
  const toneColor: Record<BadgeTone, string> = {
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    info: colors.secondaryAccent,
    ai: colors.aiAccent,
    neutral: colors.textSecondary,
    primary: colors.primary,
  };
  const color = toneColor[tone];
  const bgOpacity = isDark ? '22' : '1A';

  return (
    <View style={[styles.badge, { backgroundColor: `${color}${bgOpacity}` }]}>
      <Text style={[typography.caption, { color, fontFamily: 'Poppins-SemiBold' }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
});
