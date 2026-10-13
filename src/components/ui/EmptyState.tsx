import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, message }) => {
  const { colors, spacing } = useAppTheme();

  return (
    <View style={[styles.wrap, { paddingVertical: spacing.xxl }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}1A` }]}>
        <Icon size={26} color={colors.primary} strokeWidth={1.6} />
      </View>
      <Text style={[typography.titleMedium, { color: colors.textPrimary, marginTop: spacing.md }]}>
        {title}
      </Text>
      <Text
        style={[
          typography.bodyMedium,
          { color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
        ]}
      >
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 24 },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
