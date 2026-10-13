import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../hooks/useAppTheme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  contentStyle?: ViewStyle;
  /** Enables pull-to-refresh; the spinner shows until the promise settles. */
  onRefresh?: () => Promise<void>;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  scrollable = true,
  contentStyle,
  onRefresh,
}) => {
  const { colors, spacing } = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  const padded = { paddingHorizontal: spacing.lg, paddingBottom: 120 };

  const handleRefresh = useCallback(async (): Promise<void> => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {scrollable ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[padded, contentStyle]}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
                progressBackgroundColor={colors.card}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, padded, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
});
