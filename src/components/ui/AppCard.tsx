import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: 'default' | 'danger' | 'purple';
}

/**
 * Elevated, rounded card — the base surface of every screen.
 * On dark mode, cards float above the charcoal background with subtle
 * border glow. The 'purple' accent fills the card with the RAAH brand color.
 */
export const AppCard: React.FC<AppCardProps> = ({ children, style, accent = 'default' }) => {
  const { colors, roundness, shadows, spacing } = useAppTheme();

  const isPurple = accent === 'purple';
  const isDanger = accent === 'danger';

  const backgroundColor = isPurple
    ? colors.primary
    : colors.card;

  const borderColor = isDanger
    ? `${colors.danger}66`
    : isPurple
      ? colors.primary
      : colors.border;

  return (
    <View
      style={[
        styles.card,
        shadows.md,
        {
          backgroundColor,
          borderRadius: roundness.xl,
          borderColor,
          padding: spacing.md,
          borderWidth: isDanger ? 1 : isPurple ? 0 : StyleSheet.hairlineWidth,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
});
