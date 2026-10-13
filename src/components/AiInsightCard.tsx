import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppCard } from './ui/AppCard';
import { Badge } from './ui/Badge';
import { useAppTheme } from '../hooks/useAppTheme';
import { typography } from '../theme/typography';

interface AiInsightCardProps {
  title: string;
  children: React.ReactNode;
}

/** Card for AI-generated content, marked with a purple AI badge and a subtle left accent. */
export const AiInsightCard: React.FC<AiInsightCardProps> = ({ title, children }) => {
  const { colors, spacing } = useAppTheme();

  return (
    <AppCard style={{ marginBottom: spacing.md }}>
      <View style={[styles.accent, { backgroundColor: colors.aiAccent }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[typography.titleMedium, styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
            {title}
          </Text>
          <Badge label="AI" tone="ai" />
        </View>
        <View style={{ marginTop: spacing.sm }}>{children}</View>
      </View>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  accent: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
  },
  content: {
    paddingLeft: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, marginRight: 8 },
});
