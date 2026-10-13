import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';

interface SectionTitleProps {
  title: string;
  action?: React.ReactNode;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({ title, action }) => {
  const { colors, spacing } = useAppTheme();

  return (
    <View style={[styles.row, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
      <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>{title}</Text>
      {action}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
