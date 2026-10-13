import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle, View } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'gradient' | 'danger' | 'outline';
  style?: ViewStyle;
  labelStyle?: any; // To support TextStyle without importing it
  icon?: React.ReactNode;
}

/**
 * Primary action button. The 'gradient' variant uses the RAAH purple,
 * with a subtle glow shadow for premium feel.
 */
export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'gradient',
  style,
  labelStyle,
  icon,
}) => {
  const { colors, roundness, shadows } = useAppTheme();
  const inactive = disabled || loading;

  const backgroundColor =
    variant === 'danger' ? colors.danger : variant === 'outline' ? 'transparent' : colors.primary;
  const contentColor = variant === 'outline' ? colors.primary : '#FFFFFF';
  const btnShadow = variant === 'gradient' ? shadows.glow : shadows.sm;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        styles.button,
        btnShadow,
        {
          borderRadius: roundness.lg,
          opacity: inactive ? 0.6 : 1,
          backgroundColor,
          borderWidth: variant === 'outline' ? 1.2 : 0,
          borderColor: colors.primary,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: icon ? 8 : 0 }}>
          {icon}
          <Text style={[typography.buttonLarge, { color: contentColor }, labelStyle]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
